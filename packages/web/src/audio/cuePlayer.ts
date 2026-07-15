import type { AudioServerMessage } from '@rfutils/shared';

/**
 * Plays one cued AES67 channel through the browser. The server can't be
 * joined by the browser directly, so it relays the channel over /ws/audio as
 * PCM16 mono; here we feed it into an AudioWorklet ring buffer at the
 * announced sample rate. Single active cue app-wide (a new cue replaces the
 * old one), matching a hardware PFL/cue bus.
 */

export type CueStatus = 'idle' | 'connecting' | 'playing' | 'error';
export interface CueState {
  channelId: string | null;
  status: CueStatus;
  error?: string;
}

const WORKLET_URL = '/pcm-player-worklet.js';

class CuePlayer {
  private ctx: AudioContext | null = null;
  private node: AudioWorkletNode | null = null;
  private gain: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private ws: WebSocket | null = null;
  private channelId: string | null = null;
  private status: CueStatus = 'idle';
  private error?: string;
  private volume = 1;
  private listeners = new Set<(s: CueState) => void>();
  private meterBuf = new Float32Array(1024);

  state(): CueState {
    return { channelId: this.channelId, status: this.status, error: this.error };
  }

  subscribe(fn: (s: CueState) => void): () => void {
    this.listeners.add(fn);
    fn(this.state());
    return () => this.listeners.delete(fn);
  }

  private emit(): void {
    const s = this.state();
    for (const fn of this.listeners) fn(s);
  }

  /** Toggle helper: cue if not already cueing this channel, else stop. */
  async toggle(channelId: string): Promise<void> {
    if (this.channelId === channelId && this.status !== 'error') {
      this.stop();
    } else {
      await this.cue(channelId);
    }
  }

  async cue(channelId: string): Promise<void> {
    this.teardown();
    this.channelId = channelId;
    this.status = 'connecting';
    this.error = undefined;
    this.emit();

    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(`${proto}://${location.host}/ws/audio`);
    ws.binaryType = 'arraybuffer';
    this.ws = ws;
    ws.onopen = () => ws.send(JSON.stringify({ type: 'cue', channelId }));
    ws.onmessage = (ev) => void this.onMessage(ev);
    ws.onerror = () => this.fail('Audio connection error');
    ws.onclose = () => {
      if (this.ws === ws && this.status === 'playing') {
        // server or network closed the stream
        this.channelId = null;
        this.status = 'idle';
        this.emit();
      }
    };
  }

  stop(): void {
    this.teardown();
    this.channelId = null;
    this.status = 'idle';
    this.error = undefined;
    this.emit();
  }

  setVolume(v: number): void {
    this.volume = v;
    if (this.gain) this.gain.gain.value = v;
  }

  /** Current output level in dBFS (from the analyser), or -Infinity if idle. */
  levelDb(): number {
    if (!this.analyser) return -Infinity;
    this.analyser.getFloatTimeDomainData(this.meterBuf);
    let sum = 0;
    for (const s of this.meterBuf) sum += s * s;
    const rms = Math.sqrt(sum / this.meterBuf.length);
    return rms > 0 ? 20 * Math.log10(rms) : -Infinity;
  }

  private fail(message: string): void {
    this.status = 'error';
    this.error = message;
    this.emit();
  }

  private teardown(): void {
    if (this.ws) {
      try {
        if (this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify({ type: 'stop' }));
        this.ws.onclose = null;
        this.ws.close();
      } catch {
        /* ignore */
      }
      this.ws = null;
    }
    if (this.node) {
      try {
        this.node.disconnect();
      } catch {
        /* ignore */
      }
      this.node = null;
    }
    // AudioContext is kept for reuse across cues.
  }

  private async onMessage(ev: MessageEvent): Promise<void> {
    if (typeof ev.data === 'string') {
      let msg: AudioServerMessage;
      try {
        msg = JSON.parse(ev.data);
      } catch {
        return;
      }
      if (msg.type === 'audio-format') {
        try {
          await this.setupGraph(msg.sampleRate);
          this.status = 'playing';
          this.emit();
        } catch (e) {
          this.fail(e instanceof Error ? e.message : String(e));
        }
      } else if (msg.type === 'audio-error') {
        this.fail(msg.message);
        this.teardown();
      }
      return;
    }
    if (ev.data instanceof ArrayBuffer && this.node) {
      const i16 = new Int16Array(ev.data);
      const f32 = new Float32Array(i16.length);
      for (let i = 0; i < i16.length; i++) f32[i] = i16[i]! / 0x8000;
      this.node.port.postMessage(f32, [f32.buffer]);
    }
  }

  private async setupGraph(sampleRate: number): Promise<void> {
    if (this.ctx && this.ctx.sampleRate !== sampleRate) {
      await this.ctx.close();
      this.ctx = null;
    }
    if (!this.ctx) {
      this.ctx = new AudioContext({ sampleRate });
      await this.ctx.audioWorklet.addModule(WORKLET_URL);
    }
    if (this.ctx.state === 'suspended') await this.ctx.resume();

    this.node = new AudioWorkletNode(this.ctx, 'pcm-player', { outputChannelCount: [2] });
    this.gain = this.ctx.createGain();
    this.gain.gain.value = this.volume;
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 1024;
    this.node.connect(this.gain).connect(this.analyser).connect(this.ctx.destination);
  }
}

export const cuePlayer = new CuePlayer();

// Dev/testing aid: expose the singleton so headless checks can read levelDb().
if (typeof window !== 'undefined') {
  (window as unknown as { __rfutilsCue?: CuePlayer }).__rfutilsCue = cuePlayer;
}
