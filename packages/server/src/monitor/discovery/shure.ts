import net from 'node:net';
import os from 'node:os';
import { EventEmitter } from 'node:events';
import type { DeviceRegistry } from '../deviceRegistry.js';
import { extractFramedMessages, parseShureMessage, subnetHostsFor } from './shureProtocol.js';

/**
 * Shure "Command Strings" protocol: plaintext ASCII over TCP port 2202.
 * Discovery is a TCP connect-scan on that port, confirmed by a real protocol
 * handshake (GET ALL must get a REP back), across every directly-attached IPv4
 * subnet. NOT yet tested against real hardware — verify against your receiver's
 * command-strings PDF before relying on it.
 *
 * Parsing and host enumeration live in shureProtocol.ts so they are testable
 * without a socket.
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
          // Without this, a device that drops for any reason (reboot, a brief
          // network blip) stays permanently un-monitored: the stale Map entry
          // blocks every future rescan from retrying this host, even once it is
          // reachable again.
          client.once('disconnected', () => activeClients.delete(host));
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
  return subnetHostsFor(Object.values(os.networkInterfaces()).flatMap((entries) => entries ?? []));
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
  private disconnected = false;

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
    socket.on('error', () => this.handleDisconnect());
    socket.on('close', () => this.handleDisconnect());
    socket.on('connect', () => {
      // Ask for full state, then subscribe to periodic samples (documented Shure
      // command; period is in ms, 500ms is a conservative default).
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

  /** Fires once on error OR close, whichever comes first — see the call site in startShureDiscovery. */
  private handleDisconnect(): void {
    if (this.disconnected) return;
    this.disconnected = true;
    this.registry.remove(this.deviceId);
    this.emit('disconnected');
  }

  private handleData(chunk: string): void {
    const { messages, remainder } = extractFramedMessages(this.buffer + chunk);
    this.buffer = remainder;
    for (const message of messages) this.handleMessage(message);
  }

  private handleMessage(message: string): void {
    const existing = this.registry.get(this.deviceId);
    // The channel as last understood, so fields this message does not mention
    // survive it — a SAMPLE only carries the metered ones. See parseShureMessage.
    const channelNum = message.split(/\s+/)[1];
    const known = existing?.channels.find((c) => c.id === `${this.deviceId}:${channelNum}`);

    const parsed = parseShureMessage(message, this.deviceId, known);
    if (!parsed) return;

    const channels = existing?.channels.filter((c) => c.id !== parsed.channel.id) ?? [];
    channels.push(parsed.channel);

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
