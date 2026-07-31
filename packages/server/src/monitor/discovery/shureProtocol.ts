import type { DeviceChannel } from '@rfutils/shared';

/**
 * Pure parsing and host enumeration for Shure's Command Strings protocol, split
 * out of shure.ts's socket-handling class so it is directly unit-testable
 * without opening a TCP connection (see test/shureDiscovery.test.ts).
 *
 * Everything here was originally inline in shure.ts, which was ported verbatim
 * from MicWizard before MicWizard fixed five bugs in it. This module is the port
 * of the fixed version; each fix is described at its own function.
 */

/**
 * Splits a growing TCP buffer into complete `< ... >`-framed messages.
 *
 * Searches for '>' starting from the found '<', not from the top of the buffer.
 * A stray '>' arriving before the first '<' would otherwise put the closing index
 * *before* the opening one, and the old `end > start` loop condition then exited
 * and never recovered — parsing stalled permanently on that one leftover byte.
 * If no '<' is pending at all, stray leading bytes are dropped rather than left
 * to grow the buffer without limit.
 */
export function extractFramedMessages(buffer: string): { messages: string[]; remainder: string } {
  const messages: string[] = [];
  let remaining = buffer;
  for (;;) {
    const start = remaining.indexOf('<');
    if (start === -1) {
      return { messages, remainder: '' };
    }
    const end = remaining.indexOf('>', start);
    if (end === -1) {
      return { messages, remainder: remaining.slice(start) };
    }
    messages.push(remaining.slice(start + 1, end).trim());
    remaining = remaining.slice(end + 1);
  }
}

export interface ParsedShureMessage {
  channelNum: string;
  channel: DeviceChannel;
}

/**
 * Parses one already-unframed message body, e.g. "REP 1 BATT_CHARGE 087" or
 * "SAMPLE 1 RF_LVL_A 072 AUDIO_LVL 054".
 *
 * @param known the channel as last understood. Anything this message does not
 * mention is carried over from it. That is not an optimisation: a receiver
 * answers `GET ALL` with everything, but a periodic `SAMPLE` carries only the
 * metered fields, so rebuilding the channel from one message alone made the
 * channel name revert to "Channel 1" and the battery reading disappear at the
 * metering rate. Omission means "unchanged" in this protocol, not "null".
 */
export function parseShureMessage(
  message: string,
  deviceId: string,
  known?: DeviceChannel
): ParsedShureMessage | null {
  const parts = message.split(/\s+/);
  const [kind, channelNum, ...rest] = parts;
  if (kind !== 'REP' && kind !== 'SAMPLE') return null;
  if (!channelNum) return null;

  const fields = new Map<string, string>();
  for (let i = 0; i < rest.length - 1; i += 2) {
    fields.set(rest[i]!, rest[i + 1]!);
  }

  /** Present in this message wins; otherwise keep what was already known. */
  const keep = <T>(present: boolean, value: T, previous: T | undefined): T =>
    present ? value : (previous ?? value);

  const rfPresent = fields.has('RF_LVL_A') || fields.has('RF_LVL');

  const channel: DeviceChannel = {
    id: `${deviceId}:${channelNum}`,
    name: fields.get('CHAN_NAME') ?? known?.name ?? `Channel ${channelNum}`,
    rfLevel: keep(rfPresent, parsePercent(fields.get('RF_LVL_A') ?? fields.get('RF_LVL')), known?.rfLevel),
    audioLevelDb: keep(
      fields.has('AUDIO_LVL'),
      parseShureAudioLevel(fields.get('AUDIO_LVL')),
      known?.audioLevelDb
    ),
    batteryPercent: keep(
      fields.has('BATT_CHARGE'),
      parsePercent(fields.get('BATT_CHARGE')),
      known?.batteryPercent
    ),
    batteryMinutesRemaining: keep(
      fields.has('BATT_RUN_TIME'),
      parseMinutes(fields.get('BATT_RUN_TIME')),
      known?.batteryMinutesRemaining
    ),
    antenna: keep(fields.has('ANTENNA'), parseAntenna(fields.get('ANTENNA')), known?.antenna),
  };

  return { channelNum, channel };
}

export function parsePercent(raw: string | undefined): number | null {
  if (raw === undefined) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

export function parseMinutes(raw: string | undefined): number | null {
  if (raw === undefined) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

/** Shure reports AUDIO_LVL as a 0-100+ code, not literal dBFS — approximation pending real-hardware calibration. */
export function parseShureAudioLevel(raw: string | undefined): number | null {
  if (raw === undefined) return null;
  const value = Number(raw);
  if (!Number.isFinite(value)) return null;
  return value - 100;
}

export function parseAntenna(raw: string | undefined): DeviceChannel['antenna'] {
  if (raw === 'A') return 'A';
  if (raw === 'B') return 'B';
  if (raw === 'DIVERSITY') return 'diversity';
  return null;
}

/** The shape of one os.networkInterfaces() entry this cares about. */
export interface NetworkInterfaceInfo {
  family: string;
  address: string;
  netmask: string;
  internal: boolean;
}

/**
 * Every host address worth probing for a Shure receiver, across all local subnets.
 *
 * This used to take the *first* non-internal IPv4 interface and scan only that
 * /24, which quietly scanned the wrong network on any machine with a VM bridge or
 * a VPN client — exactly the laptop a show engineer turns up with. On one
 * development Mac the first interface is a Parallels bridge the host has no route
 * to at all, so discovery probed 253 unreachable addresses and found nothing while
 * the real rack sat on en0.
 *
 * Point-to-point interfaces (a /32, as VPN tunnels present) are skipped: there is
 * no subnet to sweep, and expanding one into 253 imaginary neighbours is pure
 * delay. Subnets larger than a /24 are swept as their /24 only — a connect-scan of
 * a /16 is 65k probes, which is not a discovery strategy.
 */
export function subnetHostsFor(interfaces: NetworkInterfaceInfo[]): string[] {
  const hosts: string[] = [];
  const seenPrefixes = new Set<string>();

  for (const entry of interfaces) {
    if (entry.family !== 'IPv4' || entry.internal) continue;
    if (entry.netmask === '255.255.255.255') continue;

    const prefix = entry.address.split('.').slice(0, 3).join('.');
    if (seenPrefixes.has(prefix)) continue;
    seenPrefixes.add(prefix);

    for (let i = 1; i <= 253; i++) hosts.push(`${prefix}.${i}`);
  }

  return hosts;
}
