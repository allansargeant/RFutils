import { spawn, type ChildProcess } from 'node:child_process';

/**
 * Captures one local audio channel (a DVS / Dante interface "cue bus" the user
 * routes mics to via Companion) by spawning a subprocess that writes signed
 * 16-bit little-endian mono PCM to stdout. Default backend is ffmpeg; any
 * command that emits s16le mono works (set RFUTILS_CAPTURE_CMD), which is how
 * the pipeline is tested without ffmpeg (a sox tone stands in).
 *
 * Config:
 *   RFUTILS_CAPTURE_CMD     full shell command emitting s16le mono (overrides all below)
 *   RFUTILS_CAPTURE_DEVICE  ffmpeg input device (e.g. ":2" avfoundation index, or a name)
 *   RFUTILS_CAPTURE_FORMAT  ffmpeg input format (default: avfoundation/dshow/alsa by OS)
 *   RFUTILS_CAPTURE_CHANNEL 0-based source channel to pick as the cue bus (default 0)
 *   RFUTILS_CAPTURE_RATE    sample rate (default 48000)
 *   RFUTILS_FFMPEG          ffmpeg binary path (default "ffmpeg")
 */

export interface CaptureConfig {
  program: string;
  args: string[];
  shell: boolean;
  sampleRate: number;
  description: string;
}

function defaultInputFormat(): string {
  switch (process.platform) {
    case 'darwin':
      return 'avfoundation';
    case 'win32':
      return 'dshow';
    default:
      return 'alsa';
  }
}

export function resolveCaptureConfig(): CaptureConfig | null {
  const sampleRate = Number(process.env.RFUTILS_CAPTURE_RATE ?? 48000);

  const explicit = process.env.RFUTILS_CAPTURE_CMD;
  if (explicit) {
    return { program: explicit, args: [], shell: true, sampleRate, description: explicit };
  }

  const device = process.env.RFUTILS_CAPTURE_DEVICE;
  if (!device) return null;

  const ffmpeg = process.env.RFUTILS_FFMPEG ?? 'ffmpeg';
  const format = process.env.RFUTILS_CAPTURE_FORMAT ?? defaultInputFormat();
  const channel = Number(process.env.RFUTILS_CAPTURE_CHANNEL ?? 0);
  // Passed as an argv array (not a shell string) so the pan filter's "|" is
  // literal, not a shell pipe.
  const args = [
    '-hide_banner',
    '-loglevel',
    'error',
    '-f',
    format,
    '-i',
    device,
    '-af',
    `pan=mono|c0=c${channel}`,
    '-ar',
    String(sampleRate),
    '-ac',
    '1',
    '-f',
    's16le',
    '-',
  ];
  return {
    program: ffmpeg,
    args,
    shell: false,
    sampleRate,
    description: `${ffmpeg} ${args.join(' ')}`,
  };
}

const BLOCK_MS = 20;

export class CaptureSource {
  private proc: ChildProcess | null = null;
  private queue: Buffer[] = [];
  private queuedBytes = 0;
  private timer: NodeJS.Timeout | null = null;
  private paused = false;
  private readonly bytesPerBlock: number;
  private readonly maxQueueBytes: number;

  constructor(
    private readonly config: CaptureConfig,
    /** called with whole PCM16 frames (even byte length), paced to real time */
    private readonly onPcm: (pcm: Buffer) => void
  ) {
    const bytesPerSec = config.sampleRate * 2; // s16 mono
    this.bytesPerBlock = Math.round((bytesPerSec * BLOCK_MS) / 1000) & ~1;
    this.maxQueueBytes = Math.round(bytesPerSec * 0.5); // cap buffering at ~500 ms
  }

  get running(): boolean {
    return this.proc !== null;
  }

  start(): void {
    if (this.proc) return;
    console.log(`[capture] starting: ${this.config.description}`);
    const proc = spawn(this.config.program, this.config.args, {
      shell: this.config.shell,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    proc.stdout?.on('data', (chunk: Buffer) => this.enqueue(chunk));
    proc.stderr?.on('data', (d: Buffer) => {
      const line = d.toString().trim();
      if (line) console.error('[capture]', line);
    });
    proc.on('error', (e) => console.error('[capture] failed to spawn:', e.message));
    proc.on('close', (code) => {
      if (this.proc === proc) {
        this.proc = null;
        if (code) console.error(`[capture] process exited with code ${code}`);
      }
    });
    this.proc = proc;
    // Emit at real time. A source producing faster than real time (e.g. a
    // signal generator, vs. a live device that's inherently real-time) fills
    // the queue; we pause its stdout so OS pipe backpressure throttles it.
    this.timer = setInterval(() => this.drainBlock(), BLOCK_MS);
    this.timer.unref?.();
  }

  private enqueue(chunk: Buffer): void {
    this.queue.push(chunk);
    this.queuedBytes += chunk.length;
    if (this.queuedBytes > this.maxQueueBytes && !this.paused) {
      this.proc?.stdout?.pause();
      this.paused = true;
    }
  }

  private drainBlock(): void {
    if (this.queuedBytes === 0) return; // underrun — consumer plays silence
    const want = Math.min(this.bytesPerBlock, this.queuedBytes & ~1);
    if (want > 0) this.onPcm(this.take(want));
    if (this.paused && this.queuedBytes < this.maxQueueBytes / 2) {
      this.proc?.stdout?.resume();
      this.paused = false;
    }
  }

  private take(n: number): Buffer {
    const parts: Buffer[] = [];
    let got = 0;
    while (got < n && this.queue.length) {
      const head = this.queue[0]!;
      if (head.length <= n - got) {
        parts.push(head);
        got += head.length;
        this.queue.shift();
      } else {
        parts.push(head.subarray(0, n - got));
        this.queue[0] = head.subarray(n - got);
        got = n;
      }
    }
    this.queuedBytes -= got;
    return Buffer.concat(parts);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (this.proc) {
      this.proc.kill('SIGTERM');
      this.proc = null;
    }
    this.queue = [];
    this.queuedBytes = 0;
    this.paused = false;
  }
}
