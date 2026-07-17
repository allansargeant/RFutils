import { describe, it, expect } from 'vitest';
import { coordinate, analyze } from '../src/coordination/engine.js';
import { defaultCoordinationParams, type CoordinationParams } from '@rfutils/shared';

function wideParams(over: Partial<CoordinationParams> = {}): CoordinationParams {
  return {
    ...defaultCoordinationParams(),
    ranges: [{ startMhz: 470, endMhz: 550 }], // 80 MHz of clear space
    ...over,
  };
}

describe('coordinate()', () => {
  it('places all requested frequencies in a wide clear band', () => {
    const r = coordinate(12, wideParams());
    expect(r.placed).toBe(12);
    expect(r.unplaced).toBe(0);
    expect(r.assigned).toHaveLength(12);
  });

  it('respects minimum spacing', () => {
    const p = wideParams({ minSpacingMhz: 0.5 });
    const r = coordinate(15, p);
    const freqs = r.assigned.map((a) => a.frequencyMhz).sort((a, b) => a - b);
    for (let i = 1; i < freqs.length; i++) {
      expect(freqs[i]! - freqs[i - 1]!).toBeGreaterThanOrEqual(0.5 - 1e-9);
    }
  });

  it('produces an IM3-clean set (analyze finds no conflicts with same params)', () => {
    const p = wideParams({ thirdOrder: true, fifthOrder: true });
    const r = coordinate(10, p);
    expect(r.placed).toBe(10);
    const a = analyze(
      r.assigned.map((x) => x.frequencyMhz),
      p
    );
    expect(a.conflicts).toEqual([]);
    expect(a.ok).toBe(true);
  });

  it('keeps assigned frequencies clear of exclusions (+guard)', () => {
    const p = wideParams({
      exclusions: [{ startMhz: 500, endMhz: 510 }],
      exclusionGuardMhz: 0.1,
    });
    const r = coordinate(10, p);
    for (const a of r.assigned) {
      expect(a.frequencyMhz < 500 - 0.1 || a.frequencyMhz > 510 + 0.1).toBe(true);
    }
  });

  it('stays compatible with locked frequencies', () => {
    const p = wideParams({ locked: [480.0, 480.5], minSpacingMhz: 0.4 });
    const r = coordinate(6, p);
    const newFreqs = r.assigned.filter((a) => !a.locked).map((a) => a.frequencyMhz);
    for (const f of newFreqs) {
      expect(Math.abs(f - 480.0)).toBeGreaterThanOrEqual(0.4 - 1e-9);
      expect(Math.abs(f - 480.5)).toBeGreaterThanOrEqual(0.4 - 1e-9);
    }
    // full set (locked + new) is IM-clean
    const a = analyze(r.assigned.map((x) => x.frequencyMhz), p);
    expect(a.ok).toBe(true);
  });

  it('is deterministic for a given seed', () => {
    const p = wideParams({ seed: 42 });
    const a = coordinate(14, p).assigned.map((x) => x.frequencyMhz);
    const b = coordinate(14, p).assigned.map((x) => x.frequencyMhz);
    expect(a).toEqual(b);
  });

  it('reports unplaced when oversubscribed', () => {
    // Narrow band, big spacing → cannot fit 50.
    const p = wideParams({ ranges: [{ startMhz: 606.5, endMhz: 608 }], minSpacingMhz: 0.4 });
    const r = coordinate(50, p);
    expect(r.placed).toBeLessThan(50);
    expect(r.unplaced).toBeGreaterThan(0);
    expect(r.notes.join(' ')).toMatch(/could be placed/i);
  });
});

describe('analyze()', () => {
  const bare = (): CoordinationParams => ({
    ...defaultCoordinationParams(),
    ranges: [],
    exclusions: [],
    minSpacingMhz: 0.4,
    thirdOrder: true,
    fifthOrder: false,
  });

  it('detects a spacing conflict', () => {
    const a = analyze([600.0, 600.1], bare());
    expect(a.ok).toBe(false);
    expect(a.conflicts.some((c) => c.kind === 'spacing')).toBe(true);
  });

  it('detects a two-transmitter IM3 collision', () => {
    // 2·500.4 − 500.8 = 500.0 → lands on the third carrier.
    const a = analyze([500.0, 500.4, 500.8], bare());
    expect(a.conflicts.some((c) => c.kind === 'im3-2tx')).toBe(true);
  });

  it('passes a well-spaced non-harmonic set', () => {
    const a = analyze([500.0, 500.475, 501.075, 501.75], bare());
    expect(a.ok).toBe(true);
  });

  it('flags out-of-range and exclusion hits', () => {
    const p: CoordinationParams = {
      ...bare(),
      ranges: [{ startMhz: 470, endMhz: 480 }],
      exclusions: [{ startMhz: 475, endMhz: 476 }],
    };
    const a = analyze([469.0, 475.5], p);
    expect(a.conflicts.some((c) => c.kind === 'out-of-range')).toBe(true);
    expect(a.conflicts.some((c) => c.kind === 'exclusion')).toBe(true);
  });
});
