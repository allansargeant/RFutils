/**
 * RMS/peak level math shared by AES67 and (eventually) USB metering paths.
 * Works on normalized float samples in [-1, 1]. Ported verbatim from MicWizard.
 */
export interface LevelReading {
  rmsDb: number;
  peakDb: number;
}

const SILENCE_FLOOR_DB = -96;

export function dbFromLinear(value: number): number {
  if (value <= 0) return SILENCE_FLOOR_DB;
  return Math.max(SILENCE_FLOOR_DB, 20 * Math.log10(value));
}

export function computeLevels(samples: Float32Array): LevelReading {
  let sumSquares = 0;
  let peak = 0;
  for (const sample of samples) {
    sumSquares += sample * sample;
    peak = Math.max(peak, Math.abs(sample));
  }
  const rms = samples.length > 0 ? Math.sqrt(sumSquares / samples.length) : 0;
  return { rmsDb: dbFromLinear(rms), peakDb: dbFromLinear(peak) };
}

/** Simple exponential smoothing so meters don't jitter frame to frame. */
export class LevelSmoother {
  private value = SILENCE_FLOOR_DB;
  constructor(
    private readonly attack = 0.6,
    private readonly release = 0.15
  ) {}

  push(db: number): number {
    const rate = db > this.value ? this.attack : this.release;
    this.value = this.value + (db - this.value) * rate;
    return this.value;
  }
}
