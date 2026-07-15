import net from 'node:net';
import os from 'node:os';
import { EventEmitter } from 'node:events';
import type { DeviceRegistry } from '../deviceRegistry.js';
import type { DeviceChannel } from '@rfwizard/shared';

/**
 * Shure "Command Strings" protocol: plaintext ASCII over TCP port 2202.
 * Ported verbatim from MicWizard. Discovery is a TCP connect-scan of the
 * local /24. NOT yet tested against real hardware — verify against your
 * receiver's command-strings PDF before relying on it.
 */
const SHURE_COMMAND_PORT = 2202;
const CONNECT_TIMEOUT_MS = 300;
const SCAN_CONCURRENCY = 32;

export interface ShureDiscoveryHandle {
  stop: () => void;
}

export function startShureDiscovery(registry: DeviceRegistry): ShureDiscoveryHandle {
  let stopped = false;
  const activeClients = new Map<string, ShureDeviceClient>();

  const scan = async () => {
    const hosts = localSubnetHosts();
    for (let i = 0; i < hosts.length && !stopped; i += SCAN_CONCURRENCY) {
      const batch = hosts.slice(i, i + SCAN_CONCURRENCY);
      await Promise.all(
        batch.map(async (host) => {
          if (activeClients.has(host)) return;
          const reachable = await probe(host);
          if (!reachable || stopped) return;
          const client = new ShureDeviceClient(host, registry);
          activeClients.set(host, client);
          client.start();
        })
      );
    }
  };

  void scan();
  const rescanTimer = setInterval(() => void scan(), 60_000);

  return {
    stop: () => {
      stopped = true;
      clearInterval(rescanTimer);
      for (const client of activeClients.values()) client.stop();
    },
  };
}

function localSubnetHosts(): string[] {
  const interfaces = os.networkInterfaces();
  for (const entries of Object.values(interfaces)) {
    for (const entry of entries ?? []) {
      if (entry.family !== 'IPv4' || entry.internal) continue;
      const prefix = entry.address.split('.').slice(0, 3).join('.');
      return Array.from({ length: 253 }, (_, i) => `${prefix}.${i + 1}`);
    }
  }
  return [];
}

function probe(host: string): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port: SHURE_COMMAND_PORT, timeout: CONNECT_TIMEOUT_MS });
    socket.once('connect', () => {
      socket.end();
      resolve(true);
    });
    socket.once('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.once('error', () => resolve(false));
  });
}

class ShureDeviceClient extends EventEmitter {
  private socket: net.Socket | null = null;
  private buffer = '';

  constructor(
    private readonly host: string,
    private readonly registry: DeviceRegistry
  ) {
    super();
  }

  start(): void {
    const socket = net.createConnection({ host: this.host, port: SHURE_COMMAND_PORT });
    socket.setEncoding('utf8');
    socket.on('data', (chunk: string) => this.handleData(chunk));
    socket.on('error', () => this.registry.remove(this.deviceId));
    socket.on('close', () => this.registry.remove(this.deviceId));
    socket.on('connect', () => {
      socket.write('< GET 1 ALL >');
      socket.write('< SET 1 METER_RATE 00500 >');
    });
    this.socket = socket;
  }

  stop(): void {
    this.socket?.end();
    this.socket = null;
  }

  private get deviceId(): string {
    return `shure:${this.host}`;
  }

  private handleData(chunk: string): void {
    this.buffer += chunk;
    let start = this.buffer.indexOf('<');
    let end = this.buffer.indexOf('>');
    while (start !== -1 && end !== -1 && end > start) {
      this.handleMessage(this.buffer.slice(start + 1, end).trim());
      this.buffer = this.buffer.slice(end + 1);
      start = this.buffer.indexOf('<');
      end = this.buffer.indexOf('>');
    }
  }

  private handleMessage(message: string): void {
    const parts = message.split(/\s+/);
    const [kind, channelNum, ...rest] = parts;
    if (kind !== 'REP' && kind !== 'SAMPLE') return;

    const fields = new Map<string, string>();
    for (let i = 0; i < rest.length - 1; i += 2) {
      fields.set(rest[i]!, rest[i + 1]!);
    }

    const channel: DeviceChannel = {
      id: `${this.deviceId}:${channelNum}`,
      name: fields.get('CHAN_NAME') ?? `Channel ${channelNum}`,
      rfLevel: parsePercent(fields.get('RF_LVL_A') ?? fields.get('RF_LVL')),
      audioLevelDb: parseShureAudioLevel(fields.get('AUDIO_LVL')),
      batteryPercent: parsePercent(fields.get('BATT_CHARGE')),
      batteryMinutesRemaining: parseMinutes(fields.get('BATT_RUN_TIME')),
      antenna: parseAntenna(fields.get('ANTENNA')),
    };

    const existing = this.registry.get(this.deviceId);
    const channels = existing?.channels.filter((c) => c.id !== channel.id) ?? [];
    channels.push(channel);

    this.registry.upsert({
      id: this.deviceId,
      vendor: 'shure',
      name: `Shure receiver (${this.host})`,
      address: this.host,
      port: SHURE_COMMAND_PORT,
      transport: 'none',
      identified: true,
      channels,
    });
  }
}

function parsePercent(raw: string | undefined): number | null {
  if (raw === undefined) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

function parseMinutes(raw: string | undefined): number | null {
  if (raw === undefined) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

/** Shure reports AUDIO_LVL as a 0-100+ code, not literal dBFS — approximation pending real-hardware calibration. */
function parseShureAudioLevel(raw: string | undefined): number | null {
  if (raw === undefined) return null;
  const value = Number(raw);
  if (!Number.isFinite(value)) return null;
  return value - 100;
}

function parseAntenna(raw: string | undefined): DeviceChannel['antenna'] {
  if (raw === 'A') return 'A';
  if (raw === 'B') return 'B';
  if (raw === 'DIVERSITY') return 'diversity';
  return null;
}
