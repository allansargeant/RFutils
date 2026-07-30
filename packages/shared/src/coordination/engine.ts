/**
 * Intermodulation-aware frequency coordination.
 *
 * Given tuning ranges, exclusions, and locked frequencies, find `count` new
 * carrier frequencies that are mutually compatible:
 *   - within an allowed range and clear of exclusions (+ guard),
 *   - at least `minSpacingMhz` from every other carrier,
 *   - with no third/fifth-order IM product landing within `imGuardMhz` of any
 *     carrier.
 *
 * Assignment is a greedy pick over the candidate grid, repeated with several
 * orderings (spread-out, low-first, high-first, and seeded shuffles) keeping
 * whichever ordering places the most — a fast, deterministic heuristic that
 * does well on the near-independent-set structure of real coordinations.
 */

import type {
  AnalysisResult,
  Conflict,
  CoordinatedFrequency,
  CoordinationParams,
  CoordinationResult,
  FreqRange,
} from '../index.js';

/** kHz-integer working unit avoids float drift on a 25 kHz raster. */
const toKhz = (mhz: number): number => Math.round(mhz * 1000);
const toMhz = (khz: number): number => khz / 1000;

/** Deterministic PRNG (mulberry32) so identical requests reproduce. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(arr: T[], rand: () => number): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/** Build the candidate grid (kHz) inside ranges, clear of exclusions+guard. */
function buildCandidates(params: CoordinationParams): number[] {
  const step = toKhz(params.stepMhz);
  const guard = toKhz(params.exclusionGuardMhz);
  const exclusions = params.exclusions.map((r) => ({
    lo: toKhz(r.startMhz) - guard,
    hi: toKhz(r.endMhz) + guard,
  }));
  const inExclusion = (khz: number): boolean =>
    exclusions.some((e) => khz >= e.lo && khz <= e.hi);

  const candidates: number[] = [];
  for (const range of params.ranges) {
    const lo = toKhz(range.startMhz);
    const hi = toKhz(range.endMhz);
    for (let f = lo; f <= hi; f += step) {
      if (!inExclusion(f)) candidates.push(f);
    }
  }
  return candidates;
}

/**
 * Would adding candidate `f` (kHz) to the already-chosen `set` (kHz) stay
 * compatible? Checks spacing and IM products against the resulting set.
 */
function isCompatible(
  f: number,
  set: number[],
  spacing: number,
  imGuard: number,
  thirdOrder: boolean,
  fifthOrder: boolean
): boolean {
  // spacing
  for (const a of set) {
    if (Math.abs(f - a) < spacing) return false;
  }
  if (!thirdOrder && !fifthOrder) return true;

  const carriers = [...set, f];
  // (a) A product that INVOLVES the new f must not land on any carrier.
  const hitsCarrier = (product: number): boolean => {
    if (product <= 0) return false;
    for (const c of carriers) {
      if (Math.abs(product - c) <= imGuard) return true;
    }
    return false;
  };
  // (b) The new carrier f must not be landed on by a product of EXISTING
  // carriers (those were cleared against existing carriers when added, but f
  // is new spectrum they might now hit).
  const productHitsF = (product: number): boolean =>
    product > 0 && Math.abs(product - f) <= imGuard;

  if (thirdOrder) {
    for (let i = 0; i < set.length; i++) {
      const a = set[i]!;
      if (hitsCarrier(2 * f - a) || hitsCarrier(2 * a - f)) return false; // (a)
      for (let j = 0; j < set.length; j++) {
        if (i === j) continue;
        const b = set[j]!;
        if (hitsCarrier(f + a - b)) return false; // (a) 3-tx incl. f
        if (productHitsF(2 * a - b)) return false; // (b) existing 2-tx onto f
        for (let k = j + 1; k < set.length; k++) {
          if (k === i) continue;
          const c = set[k]!;
          if (productHitsF(a + b - c) || productHitsF(a + c - b) || productHitsF(b + c - a)) {
            return false; // (b) existing 3-tx onto f
          }
        }
      }
    }
  }

  if (fifthOrder) {
    for (let i = 0; i < set.length; i++) {
      const a = set[i]!;
      if (hitsCarrier(3 * f - 2 * a) || hitsCarrier(3 * a - 2 * f)) return false; // (a)
      for (let j = 0; j < set.length; j++) {
        if (i === j) continue;
        const b = set[j]!;
        if (productHitsF(3 * a - 2 * b)) return false; // (b) existing 5th onto f
      }
    }
  }

  return true;
}

/** Greedy fill of `count` freqs from `candidates` (all kHz), respecting locks. */
function greedyPlace(
  candidates: number[],
  locked: number[],
  count: number,
  params: CoordinationParams
): number[] {
  const spacing = toKhz(params.minSpacingMhz);
  const imGuard = toKhz(params.imGuardMhz);
  const chosen: number[] = [];
  for (const f of candidates) {
    if (chosen.length >= count) break;
    const set = [...locked, ...chosen];
    if (isCompatible(f, set, spacing, imGuard, params.thirdOrder, params.fifthOrder)) {
      chosen.push(f);
    }
  }
  return chosen;
}

/** Order candidates so picks spread across the band (bisection order). */
function spreadOrder(candidates: number[]): number[] {
  const sorted = candidates.slice().sort((a, b) => a - b);
  const out: number[] = [];
  const recurse = (lo: number, hi: number): void => {
    if (lo > hi) return;
    const mid = (lo + hi) >> 1;
    out.push(sorted[mid]!);
    recurse(lo, mid - 1);
    recurse(mid + 1, hi);
  };
  recurse(0, sorted.length - 1);
  return out;
}

export function coordinate(
  count: number,
  params: CoordinationParams,
  names?: string[]
): CoordinationResult {
  const candidates = buildCandidates(params);
  const locked = params.locked.map(toKhz);
  const notes: string[] = [];

  if (count <= 0) {
    return {
      assigned: params.locked.map((f, i) => ({ name: names?.[i] ?? `Lock ${i + 1}`, frequencyMhz: f, locked: true })),
      requested: 0,
      placed: 0,
      unplaced: 0,
      candidateCount: candidates.length,
      notes: ['Nothing requested.'],
    };
  }

  const rand = mulberry32((params.seed ?? 1) >>> 0);
  const orderings: number[][] = [
    spreadOrder(candidates),
    candidates.slice().sort((a, b) => a - b),
    candidates.slice().sort((a, b) => b - a),
  ];
  for (let i = 0; i < 8; i++) orderings.push(shuffle(candidates, rand));

  let best: number[] = [];
  for (const ordering of orderings) {
    const placed = greedyPlace(ordering, locked, count, params);
    if (placed.length > best.length) best = placed;
    if (best.length >= count) break;
  }

  best.sort((a, b) => a - b);
  const assigned: CoordinatedFrequency[] = [
    ...params.locked.map((f, i) => ({ name: `Lock ${i + 1}`, frequencyMhz: f, locked: true })),
    ...best.map((khz, i) => ({ name: names?.[i] ?? `Ch ${i + 1}`, frequencyMhz: toMhz(khz) })),
  ];

  const placed = best.length;
  const unplaced = count - placed;
  if (unplaced > 0) {
    notes.push(
      `Only ${placed} of ${count} requested frequencies could be placed with the given ranges, ` +
        `spacing and IM settings. Widen the ranges, reduce spacing, or relax IM avoidance.`
    );
  } else {
    notes.push(`Placed all ${count} frequencies.`);
  }
  if (candidates.length === 0) notes.push('No candidate frequencies — check ranges vs exclusions.');

  return { assigned, requested: count, placed, unplaced, candidateCount: candidates.length, notes };
}

/**
 * Report all conflicts in an existing frequency set — spacing, exclusions,
 * out-of-range, and IM collisions. Used to sanity-check a loaded coordination
 * list or a manual plan.
 */
export function analyze(frequenciesMhz: number[], params: CoordinationParams): AnalysisResult {
  const freqs = frequenciesMhz.map(toKhz);
  const spacing = toKhz(params.minSpacingMhz);
  const imGuard = toKhz(params.imGuardMhz);
  const exGuard = toKhz(params.exclusionGuardMhz);
  const conflicts: Conflict[] = [];

  const inAnyRange = (f: number): boolean =>
    params.ranges.some((r) => f >= toKhz(r.startMhz) && f <= toKhz(r.endMhz));
  const exclusions: FreqRange[] = params.exclusions;

  freqs.forEach((f) => {
    if (params.ranges.length && !inAnyRange(f)) {
      conflicts.push({
        kind: 'out-of-range',
        frequencies: [toMhz(f)],
        atMhz: toMhz(f),
        message: `${toMhz(f).toFixed(3)} MHz is outside the coordination ranges.`,
      });
    }
    for (const ex of exclusions) {
      if (f >= toKhz(ex.startMhz) - exGuard && f <= toKhz(ex.endMhz) + exGuard) {
        conflicts.push({
          kind: 'exclusion',
          frequencies: [toMhz(f)],
          atMhz: toMhz(f),
          message: `${toMhz(f).toFixed(3)} MHz falls in an excluded region (${ex.startMhz}–${ex.endMhz} MHz).`,
        });
      }
    }
  });

  // spacing
  for (let i = 0; i < freqs.length; i++) {
    for (let j = i + 1; j < freqs.length; j++) {
      if (Math.abs(freqs[i]! - freqs[j]!) < spacing) {
        conflicts.push({
          kind: 'spacing',
          frequencies: [toMhz(freqs[i]!), toMhz(freqs[j]!)],
          atMhz: toMhz(freqs[i]!),
          message: `${toMhz(freqs[i]!).toFixed(3)} and ${toMhz(freqs[j]!).toFixed(3)} MHz are closer than ${params.minSpacingMhz} MHz.`,
        });
      }
    }
  }

  const hits = (product: number): number | null => {
    if (product <= 0) return null;
    for (const c of freqs) {
      if (Math.abs(product - c) <= imGuard) return c;
    }
    return null;
  };

  if (params.thirdOrder) {
    for (let i = 0; i < freqs.length; i++) {
      for (let j = 0; j < freqs.length; j++) {
        if (i === j) continue;
        const p = 2 * freqs[i]! - freqs[j]!;
        const hit = hits(p);
        if (hit !== null && hit !== freqs[i]! && hit !== freqs[j]!) {
          conflicts.push({
            kind: 'im3-2tx',
            frequencies: [toMhz(freqs[i]!), toMhz(freqs[j]!)],
            atMhz: toMhz(p),
            message: `2·${toMhz(freqs[i]!).toFixed(3)}−${toMhz(freqs[j]!).toFixed(3)} = ${toMhz(p).toFixed(3)} MHz lands on ${toMhz(hit).toFixed(3)} MHz.`,
          });
        }
      }
    }
    for (let i = 0; i < freqs.length; i++) {
      for (let j = i + 1; j < freqs.length; j++) {
        for (let k = 0; k < freqs.length; k++) {
          if (k === i || k === j) continue;
          const p = freqs[i]! + freqs[j]! - freqs[k]!;
          const hit = hits(p);
          if (hit !== null && hit !== freqs[i]! && hit !== freqs[j]!) {
            conflicts.push({
              kind: 'im3-3tx',
              frequencies: [toMhz(freqs[i]!), toMhz(freqs[j]!), toMhz(freqs[k]!)],
              atMhz: toMhz(p),
              message: `${toMhz(freqs[i]!).toFixed(3)}+${toMhz(freqs[j]!).toFixed(3)}−${toMhz(freqs[k]!).toFixed(3)} = ${toMhz(p).toFixed(3)} MHz lands on ${toMhz(hit).toFixed(3)} MHz.`,
            });
          }
        }
      }
    }
  }

  if (params.fifthOrder) {
    for (let i = 0; i < freqs.length; i++) {
      for (let j = 0; j < freqs.length; j++) {
        if (i === j) continue;
        const p = 3 * freqs[i]! - 2 * freqs[j]!;
        const hit = hits(p);
        if (hit !== null && hit !== freqs[i]! && hit !== freqs[j]!) {
          conflicts.push({
            kind: 'im5-2tx',
            frequencies: [toMhz(freqs[i]!), toMhz(freqs[j]!)],
            atMhz: toMhz(p),
            message: `3·${toMhz(freqs[i]!).toFixed(3)}−2·${toMhz(freqs[j]!).toFixed(3)} = ${toMhz(p).toFixed(3)} MHz lands on ${toMhz(hit).toFixed(3)} MHz.`,
          });
        }
      }
    }
  }

  return { frequencyCount: freqs.length, conflicts, ok: conflicts.length === 0 };
}
