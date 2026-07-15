import { EventEmitter } from 'node:events';
import type {
  CompanionStatus,
  CrosspointRequest,
  DiscoveredDevice,
  ServerToClientEvent,
} from '@rfutils/shared';
import { DeviceRegistry } from './deviceRegistry.js';
import { startMdnsDiscovery, type MdnsDiscoveryHandle } from './discovery/mdns.js';
import { startShureDiscovery, type ShureDiscoveryHandle } from './discovery/shure.js';
import { SapListener } from './audio/sap.js';
import { monitorAes67Stream, type Aes67StreamHandle } from './audio/aes67.js';
import { loadCompanionConfig } from './companion/routesConfig.js';
import { CompanionClient } from './companion/companionClient.js';

/**
 * Owns all live-monitoring discovery (the raw sockets a browser can't open)
 * and republishes device state as ServerToClientEvents. This is MicWizard's
 * main-process startDiscovery + IPC handlers, re-homed in the web server;
 * the browser subscribes over WebSocket instead of Electron IPC.
 *
 * Note: raw AES67 audio cueing to headphones (a MicWizard feature that ran
 * in the Electron renderer) is intentionally out of scope for the browser
 * build — the server decodes AES67 and publishes per-channel *levels*; a
 * browser can't join a multicast RTP group directly. Level/battery/RF
 * telemetry all flow through as before.
 */
export declare interface MonitorService {
  on(event: 'event', listener: (event: ServerToClientEvent) => void): this;
}

export class MonitorService extends EventEmitter {
  private registry = new DeviceRegistry();
  private mdns: MdnsDiscoveryHandle | null = null;
  private shure: ShureDiscoveryHandle | null = null;
  private sap: SapListener | null = null;
  private aes67Streams = new Map<string, Aes67StreamHandle>();
  private pruneTimer: NodeJS.Timeout | null = null;
  private started = false;

  constructor() {
    super();
    this.registry.on('event', (event: ServerToClientEvent) => this.emit('event', event));
  }

  start(): void {
    if (this.started) return;
    this.started = true;

    this.mdns = startMdnsDiscovery(this.registry);
    this.shure = startShureDiscovery(this.registry);

    const sap = new SapListener();
    sap.on('session', (session) => {
      if (this.aes67Streams.has(session.sessionId)) return;
      const handle = monitorAes67Stream(
        session,
        (updates) => {
          const device = this.registry.get(`aes67:${session.sessionId}`);
          const channels = updates.map((u) => ({
            id: `aes67:${session.sessionId}:${u.channelIndex}`,
            name: `${session.name} ch${u.channelIndex + 1}`,
            rfLevel: null,
            audioLevelDb: u.smoothedDb,
            batteryPercent: null,
            batteryMinutesRemaining: null,
            antenna: null,
          }));
          this.registry.upsert({
            id: `aes67:${session.sessionId}`,
            vendor: 'unknown-dante',
            name: session.name,
            address: session.originAddress,
            port: session.port,
            transport: 'aes67',
            identified: true,
            channels: device ? mergeChannels(device.channels, channels) : channels,
          });
        },
        () => {
          /* raw sample streaming to the browser is out of scope — see class doc */
        }
      );
      this.aes67Streams.set(session.sessionId, handle);
    });
    sap.on('session-deleted', (sessionId) => {
      this.aes67Streams.get(sessionId)?.stop();
      this.aes67Streams.delete(sessionId);
      this.registry.remove(`aes67:${sessionId}`);
    });
    sap.start();
    this.sap = sap;

    this.pruneTimer = setInterval(() => this.registry.pruneStale(120_000), 30_000);
    this.emit('event', { type: 'discovery-status', scanning: true } satisfies ServerToClientEvent);
  }

  stop(): void {
    this.mdns?.stop();
    this.shure?.stop();
    this.sap?.stop();
    for (const handle of this.aes67Streams.values()) handle.stop();
    this.aes67Streams.clear();
    if (this.pruneTimer) clearInterval(this.pruneTimer);
    this.started = false;
  }

  snapshot(): DiscoveredDevice[] {
    return this.registry.list();
  }

  async companionStatus(): Promise<CompanionStatus> {
    const config = loadCompanionConfig();
    if (!config) return { configured: false, host: null, port: null, reachable: null, canClear: false };
    const reachable = await new CompanionClient(config).checkReachable();
    return {
      configured: true,
      host: config.host,
      port: config.port,
      reachable,
      canClear: config.clearCrosspointButton !== null,
    };
  }

  async makeCrosspoint(request: CrosspointRequest): Promise<void> {
    const config = loadCompanionConfig();
    if (!config) throw new Error('No companion-routes.json configured — see README');
    await new CompanionClient(config).makeCrosspoint(request);
  }

  async clearCrosspoint(destinationChannel: string, destinationDevice: string): Promise<void> {
    const config = loadCompanionConfig();
    if (!config) throw new Error('No companion-routes.json configured — see README');
    await new CompanionClient(config).clearCrosspoint(destinationChannel, destinationDevice);
  }
}

function mergeChannels<T extends { id: string }>(existing: T[], incoming: T[]): T[] {
  const byId = new Map(existing.map((c) => [c.id, c]));
  for (const channel of incoming) byId.set(channel.id, channel);
  return [...byId.values()];
}
