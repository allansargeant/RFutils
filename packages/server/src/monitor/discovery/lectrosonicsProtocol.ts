/**
 * Lectrosonics networked-receiver protocol (DSQD / D Squared, Duet, DCR822).
 *
 * ⚠️ UNVERIFIED WIRE FORMAT. Lectrosonics receivers with an Ethernet port are
 * controlled by "Wireless Designer" and the port is documented as open to
 * third-party control, but the exact framing below is a best-effort
 * PLACEHOLDER, not confirmed against hardware or the official spec. Everything
 * that consumes this module (discovery, telemetry, programming, the API path,
 * dry-run) is real and complete — only the constants and the two builder /
 * parser functions here need correcting once you have a packet capture or the
 * Lectrosonics IP-control document. Keep all wire specifics in THIS file so a
 * correction is a one-file change.
 *
 * Every field is overridable at runtime so you can point it at the real values
 * without editing code:
 *   RFUTILS_LECTRO_PORT   TCP control port (default below)
 *   RFUTILS_LECTRO_TERM   line terminator: "cr" | "lf" | "crlf" (default cr)
 */

/** PLACEHOLDER control port — verify against your DSQD before relying on it. */
const DEFAULT_PORT = 4992;

export function lectroPort(): number {
  const raw = process.env.RFUTILS_LECTRO_PORT;
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_PORT;
}

export function lectroTerminator(): string {
  switch ((process.env.RFUTILS_LECTRO_TERM ?? 'cr').toLowerCase()) {
    case 'lf':
      return '\n';
    case 'crlf':
      return '\r\n';
    case 'cr':
    default:
      return '\r';
  }
}

/** Wrap a bare command in the wire terminator. */
export function frameCommand(command: string): string {
  return command + lectroTerminator();
}

/**
 * Split an accumulated receive buffer into complete frames on any of CR / LF,
 * returning the leftover partial tail. Tolerant of CR, LF or CRLF so a wrong
 * RFUTILS_LECTRO_TERM guess still parses inbound telemetry.
 */
export function splitFrames(buffer: string): { frames: string[]; rest: string } {
  const parts = buffer.split(/\r\n|\r|\n/);
  const rest = parts.pop() ?? '';
  return { frames: parts.map((f) => f.trim()).filter(Boolean), rest };
}

export interface LectroTelemetry {
  channel: number;
  name?: string;
  frequencyMhz?: number;
  rfLevel?: number | null;
  audioLevelDb?: number | null;
  batteryPercent?: number | null;
}

/**
 * Best-effort parse of one telemetry frame. The placeholder shape assumes a
 * whitespace-delimited `RX <ch> KEY value KEY value …` reply (mirroring the
 * general style of such gear); unknown frames return null and are ignored.
 * Replace with the real field names once known.
 */
export function parseTelemetry(frame: string): LectroTelemetry | null {
  const parts = frame.split(/\s+/);
  if (parts[0] !== 'RX' && parts[0] !== 'REP') return null;
  const channel = Number(parts[1]);
  if (!Number.isFinite(channel)) return null;

  const fields = new Map<string, string>();
  for (let i = 2; i < parts.length - 1; i += 2) fields.set(parts[i]!, parts[i + 1]!);

  const num = (key: string): number | null => {
    const v = fields.get(key);
    if (v === undefined) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };

  const freqKhz = num('FREQ');
  return {
    channel,
    name: fields.get('NAME'),
    frequencyMhz: freqKhz != null ? freqKhz / 1000 : undefined,
    rfLevel: num('RF'),
    audioLevelDb: num('AUDIO'),
    batteryPercent: num('BATT'),
  };
}

/** The queries a fresh connection sends to identify + start telemetry. */
export function identifyCommands(): string[] {
  return ['QUERY ALL'];
}

/**
 * Default program-command template for the plugin descriptor. `{ch}` channel,
 * `{khz}` integer kHz, `{khz6}` 6-digit kHz, `{mhz3}` MHz. Overridable per
 * product via the plugin's `programTemplate`.
 */
export const LECTRO_PROGRAM_TEMPLATE = 'SET {ch} FREQ {khz}';
