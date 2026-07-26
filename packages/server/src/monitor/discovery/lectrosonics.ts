import net from 'node:net';
import os from 'node:os';
import type { DeviceRegistry } from '../deviceRegistry.js';
import type { DeviceChannel } from '@rfutils/shared';
import {
  lectroPort,
  frameCommand,
  splitFrames,
  parseTelemetry,
  identifyCommands,
} from './lectrosonicsProtocol.js';

/**
 * Lectrosonics networked-receiver monitor adapter (DSQD / D Squared, Duet).
 * Transport + wiring are complete; the wire format lives in (and is corrected
 * in) lectrosonicsProtocol.ts — see its banner.
 *
 * Because the default control port is an unverified PLACEHOLDER, this adapter
 * does NOT auto-scan the LAN by default (unlike Shure): opt in with
 * RFUTILS_LECTRO_SCAN=1 once the port is confirmed, or connect a known unit by
 * address via connectLectrosonicsDevice(). Programming targets an explicit
 * address and works regardless of discovery.
 */
const CONNECT_TIMEOUT_MS = 300;
const SCAN_CONCURRENCY = 32;

export interface LectrosonicsDiscoveryHandle {
  stop: () => void;
}

/** Opt-in subnet scan (RFUTILS_LECTRO_SCAN=1). No-op otherwise. */
export function startLectrosonicsDiscovery(registry: DeviceRegistry): LectrosonicsDiscoveryHandle {
  if (process.env.RFUTILS_LECTRO_SCAN !== '1') {
    return { stop: () => {} };
  }
  let stopped = false;
  const clients = new Map<string, LectrosonicsDeviceClient>();

  const scan = async (): Promise<void> => {
    const port = lectroPort();
    const hosts = localSubnetHosts();
    for (let i = 0; i < hosts.length && !stopped; i += SCAN_CONCURRENCY) {
      const batch = hosts.slice(i, i + SCAN_CONCURRENCY);
      await Promise.all(
        batch.map(async (host) => {
          if (clients.has(host)) return;
          if (!(await probe(host, port)) || stopped) return;
          const client = connectLectrosonicsDevice(host, registry);
          clients.set(host, client);
        })
      );
    }
  };

  void scan();
  const rescan = setInterval(() => void scan(), 60_000);

  return {
    stop: () => {
      stopped = true;
      clearInterval(rescan);
      for (const c of clients.values()) c.stop();
    },
  };
}

/** Connect a known Lectrosonics receiver by IP and stream its telemetry. */
export function connectLectrosonicsDevice(
  address: string,
  registry: DeviceRegistry
): LectrosonicsDeviceClient {
  const client = new LectrosonicsDeviceClient(address, registry);
  client.start();
  return client;
}

export class LectrosonicsDeviceClient {
  private socket: net.Socket | null = null;
  private buffer = '';

  constructor(
    private readonly host: string,
    private readonly registry: DeviceRegistry
  ) {}

  private get deviceId(): string {
    return `lectrosonics:${this.host}`;
  }

  start(): void {
    const socket = net.createConnection({ host: this.host, port: lectroPort() });
    socket.setEncoding('utf8');
    socket.on('connect', () => {
      for (const cmd of identifyCommands()) socket.write(frameCommand(cmd));
    });
    socket.on('data', (chunk: string) => this.handleData(chunk));
    socket.on('error', () => this.registry.remove(this.deviceId));
    socket.on('close', () => this.registry.remove(this.deviceId));
    this.socket = socket;
  }

  stop(): void {
    this.socket?.end();
    this.socket = null;
  }

  private handleData(chunk: string): void {
    this.buffer += chunk;
    const { frames, rest } = splitFrames(this.buffer);
    this.buffer = rest;
    for (const frame of frames) this.handleFrame(frame);
  }

  private handleFrame(frame: string): void {
    const t = parseTelemetry(frame);
    if (!t) return;

    const channel: DeviceChannel = {
      id: `${this.deviceId}:${t.channel}`,
      name: t.name ?? `Channel ${t.channel}`,
      rfLevel: t.rfLevel ?? null,
      audioLevelDb: t.audioLevelDb ?? null,
      batteryPercent: t.batteryPercent ?? null,
      batteryMinutesRemaining: null,
      antenna: null,
    };

    const existing = this.registry.get(this.deviceId);
    const channels = existing?.channels.filter((c) => c.id !== channel.id) ?? [];
    channels.push(channel);

    this.registry.upsert({
      id: this.deviceId,
      vendor: 'lectrosonics',
      name: `Lectrosonics receiver (${this.host})`,
      address: this.host,
      port: lectroPort(),
      transport: 'none',
      identified: true,
      channels,
    });
  }
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

function probe(host: string, port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port, timeout: CONNECT_TIMEOUT_MS });
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
