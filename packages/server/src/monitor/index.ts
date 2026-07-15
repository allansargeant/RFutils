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
import { seedMockDevices } from './mockDevices.js';
import { resolveCaptureConfig, CaptureSource, type CaptureConfig } from './captureSource.js';

/** Fixed channelId for the DVS/Dante-interface "cue bus" the server captures. */
const CAPTURE_CUE_ID = 'capture:cue';

export type AudioMode = 'capture' | 'direct';

/**
 * Owns all live-monitoring discovery (the raw sockets a browser can't open)
 * and republishes device state as ServerToClientEvents. This is MicWizard's
 * main-process startDiscovery + IPC handlers, re-homed in the web server;
 * the browser subscribes over WebSocket instead of Electron IPC.
 *
 * Audio cueing: a browser can't join the AES67 RTP multicast group, so the
 * server relays it. When a client cues a channel (startCue), we enable
 * per-channel PCM streaming on the already-decoded AES67 stream and emit
 * 'audio' frames (PCM16 mono) that the server forwards over /ws/audio. In
 * mock mode a synthetic tone stands in for real Dante audio so the pipeline
 * is demoable without hardware.
 */
export interface AudioFrame {
  channelId: string;
  sampleRate: number;
  channels: 1;
  /** signed 16-bit little-endian mono PCM */
  pcm: Buffer;
}

export declare interface MonitorService {
  on(event: 'event', listener: (event: ServerToClientEvent) => void): this;
  on(event: 'audio', listener: (frame: AudioFrame) => void): this;
}

export class MonitorService extends EventEmitter {
  private registry = new DeviceRegistry();
  private mdns: MdnsDiscoveryHandle | null = null;
  private shure: ShureDiscoveryHandle | null = null;
  private sap: SapListener | null = null;
  private aes67Streams = new Map<string, Aes67StreamHandle>();
  private aes67SampleRates = new Map<string, number>();
  /** channelId -> number of clients currently cueing it (ref count) */
  private cueCounts = new Map<string, number>();
  /** channelId -> synthetic-tone interval (mock mode only) */
  private mockToneTimers = new Map<string, NodeJS.Timeout>();
  private mockTonePhase = new Map<string, number>();
  private pruneTimer: NodeJS.Timeout | null = null;
  private started = false;

  // Capture (DVS / Dante interface cue bus) mode
  private captureConfig: CaptureConfig | null = resolveCaptureConfig();
  private capture: CaptureSource | null = null;
  private captureCount = 0;

  constructor() {
    super();
    this.registry.on('event', (event: ServerToClientEvent) => this.emit('event', event));
    if (this.captureConfig) {
      this.capture = new CaptureSource(this.captureConfig, (pcm) => {
        this.emit('audio', {
          channelId: CAPTURE_CUE_ID,
          sampleRate: this.captureConfig!.sampleRate,
          channels: 1,
          pcm,
        } satisfies AudioFrame);
      });
    }
  }

  /** 'capture' when a DVS/Dante interface is configured, else direct AES67. */
  audioMode(): AudioMode {
    return this.captureConfig ? 'capture' : 'direct';
  }

  /** Whether a Companion cue-bus destination is configured for auto-routing. */
  cueBusConfigured(): boolean {
    return !!(process.env.RFUTILS_CUE_BUS_DEVICE && process.env.RFUTILS_CUE_BUS_CHANNEL);
  }

  start(): void {
    if (this.started) return;
    this.started = true;

    // Demo mode: seed simulated receivers and skip real network discovery.
    if (process.env.RFUTILS_MOCK_DEVICES === '1') {
      seedMockDevices(this.registry);
      this.emit('event', {
        type: 'discovery-status',
        scanning: false,
        message: 'mock devices',
      } satisfies ServerToClientEvent);
      return;
    }

    this.mdns = startMdnsDiscovery(this.registry);
    this.shure = startShureDiscovery(this.registry);

    const sap = new SapListener();
    sap.on('session', (session) => {
      if (this.aes67Streams.has(session.sessionId)) return;
      this.aes67SampleRates.set(session.sessionId, session.sampleRate);
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
        (channelIndex, samples, sampleRate) => {
          this.emitAudio(`aes67:${session.sessionId}:${channelIndex}`, samples, sampleRate);
        }
      );
      this.aes67Streams.set(session.sessionId, handle);
    });
    sap.on('session-deleted', (sessionId) => {
      this.aes67Streams.get(sessionId)?.stop();
      this.aes67Streams.delete(sessionId);
      this.aes67SampleRates.delete(sessionId);
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
    this.aes67SampleRates.clear();
    for (const timer of this.mockToneTimers.values()) clearInterval(timer);
    this.mockToneTimers.clear();
    this.cueCounts.clear();
    this.capture?.stop();
    this.captureCount = 0;
    if (this.pruneTimer) clearInterval(this.pruneTimer);
    this.started = false;
  }

  // --- audio cueing --------------------------------------------------------

  private static parseAes67ChannelId(
    channelId: string
  ): { sessionId: string; channelIndex: number } | null {
    const parts = channelId.split(':');
    if (parts.length !== 3 || parts[0] !== 'aes67') return null;
    const channelIndex = Number(parts[2]);
    if (!Number.isInteger(channelIndex) || channelIndex < 0) return null;
    return { sessionId: parts[1]!, channelIndex };
  }

  /**
   * Begin relaying audio for a cued channel. Returns the stream format and the
   * internal channelId whose frames feed this cue (`streamChannelId`), or null
   * if the channel isn't cueable.
   *
   * In **capture mode** any channel is cueable: the server best-effort asks
   * Companion to route it to the DVS cue bus, then streams the captured bus
   * (streamChannelId = 'capture:cue'). In **direct AES67 mode** only AES67
   * channels are cueable and each plays its own decoded audio.
   */
  async startCue(
    channelId: string
  ): Promise<{ sampleRate: number; channels: 1; streamChannelId: string } | null> {
    if (this.captureConfig && this.capture) {
      // Best-effort: route the clicked channel to the cue bus via Companion.
      void this.routeChannelToCueBus(channelId).catch((e) =>
        console.error('[cue] Companion route failed:', (e as Error).message)
      );
      this.captureCount++;
      if (this.captureCount === 1) this.capture.start();
      return { sampleRate: this.captureConfig.sampleRate, channels: 1, streamChannelId: CAPTURE_CUE_ID };
    }

    // Direct AES67 mode.
    const parsed = MonitorService.parseAes67ChannelId(channelId);
    if (!parsed) return null;

    const handle = this.aes67Streams.get(parsed.sessionId);
    if (!handle) {
      if (process.env.RFUTILS_MOCK_DEVICES === '1' && this.registry.get(`aes67:${parsed.sessionId}`)) {
        this.startMockTone(channelId, parsed.channelIndex);
        return { sampleRate: 48000, channels: 1, streamChannelId: channelId };
      }
      return null;
    }

    const count = (this.cueCounts.get(channelId) ?? 0) + 1;
    this.cueCounts.set(channelId, count);
    if (count === 1) handle.setSampleStreaming(parsed.channelIndex, true);
    return {
      sampleRate: this.aes67SampleRates.get(parsed.sessionId) ?? 48000,
      channels: 1,
      streamChannelId: channelId,
    };
  }

  stopCue(channelId: string): void {
    if (this.captureConfig && this.capture) {
      this.captureCount = Math.max(0, this.captureCount - 1);
      if (this.captureCount === 0) {
        this.capture.stop();
        void this.clearCueBus().catch(() => {
          /* best-effort */
        });
      }
      return;
    }

    const parsed = MonitorService.parseAes67ChannelId(channelId);
    if (!parsed) return;

    if (this.mockToneTimers.has(channelId)) {
      clearInterval(this.mockToneTimers.get(channelId)!);
      this.mockToneTimers.delete(channelId);
      this.mockTonePhase.delete(channelId);
      return;
    }

    const count = (this.cueCounts.get(channelId) ?? 0) - 1;
    if (count <= 0) {
      this.cueCounts.delete(channelId);
      this.aes67Streams.get(parsed.sessionId)?.setSampleStreaming(parsed.channelIndex, false);
    } else {
      this.cueCounts.set(channelId, count);
    }
  }

  private findChannel(channelId: string): { deviceName: string; channelName: string } | null {
    for (const device of this.registry.list()) {
      const ch = device.channels.find((c) => c.id === channelId);
      if (ch) return { deviceName: device.name, channelName: ch.name };
    }
    return null;
  }

  /** Route a discovered channel to the configured cue-bus destination via Companion. */
  private async routeChannelToCueBus(channelId: string): Promise<void> {
    const dstDevice = process.env.RFUTILS_CUE_BUS_DEVICE;
    const dstChannel = process.env.RFUTILS_CUE_BUS_CHANNEL;
    if (!dstDevice || !dstChannel) return; // no cue bus configured: rely on manual routing
    const config = loadCompanionConfig();
    if (!config) return;
    const src = this.findChannel(channelId);
    if (!src) return;
    await new CompanionClient(config).makeCrosspoint({
      // Source names must match your Dante Controller labels; see README.
      sourceDevice: process.env.RFUTILS_CUE_SRC_DEVICE ?? src.deviceName,
      sourceChannel: src.channelName,
      destinationDevice: dstDevice,
      destinationChannel: dstChannel,
    });
  }

  private async clearCueBus(): Promise<void> {
    const dstDevice = process.env.RFUTILS_CUE_BUS_DEVICE;
    const dstChannel = process.env.RFUTILS_CUE_BUS_CHANNEL;
    if (!dstDevice || !dstChannel) return;
    const config = loadCompanionConfig();
    if (!config || !config.clearCrosspointButton) return;
    await new CompanionClient(config).clearCrosspoint(dstChannel, dstDevice);
  }

  private emitAudio(channelId: string, samples: Float32Array, sampleRate: number): void {
    const pcm = Buffer.allocUnsafe(samples.length * 2);
    for (let i = 0; i < samples.length; i++) {
      const s = Math.max(-1, Math.min(1, samples[i]!));
      pcm.writeInt16LE((s < 0 ? s * 0x8000 : s * 0x7fff) | 0, i * 2);
    }
    this.emit('audio', { channelId, sampleRate, channels: 1, pcm } satisfies AudioFrame);
  }

  /** Emit a steady sine tone for a mock AES67 channel (demo without hardware). */
  private startMockTone(channelId: string, channelIndex: number): void {
    if (this.mockToneTimers.has(channelId)) return;
    const sampleRate = 48000;
    const freq = 330 + channelIndex * 110; // A-ish tones, distinct per channel
    const blockMs = 40;
    const blockSamples = Math.round((sampleRate * blockMs) / 1000);
    this.mockTonePhase.set(channelId, 0);
    const timer = setInterval(() => {
      let phase = this.mockTonePhase.get(channelId) ?? 0;
      const samples = new Float32Array(blockSamples);
      const step = (2 * Math.PI * freq) / sampleRate;
      for (let i = 0; i < blockSamples; i++) {
        samples[i] = Math.sin(phase) * 0.25;
        phase += step;
      }
      this.mockTonePhase.set(channelId, phase % (2 * Math.PI));
      this.emitAudio(channelId, samples, sampleRate);
    }, blockMs);
    timer.unref?.();
    this.mockToneTimers.set(channelId, timer);
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
