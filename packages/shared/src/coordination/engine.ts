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
  CoordinationRadio,
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

/**
 * Would adding candidate `f` (kHz) to the already-chosen `set` (kHz) keep the
 * set free of intermodulation products landing on a carrier?
 *
 * Spacing is deliberately not checked here: each radio carries its own
 * requirement, so separation is computed per pair by `separationOk` rather than
 * against one scalar.
 */
function imCompatible(
  f: number,
  set: number[],
  imGuard: number,
  thirdOrder: boolean,
  fifthOrder: boolean
): boolean {
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

/** Overlap of two range lists, MHz. */
function intersectRanges(a: FreqRange[], b: FreqRange[]): FreqRange[] {
  const out: FreqRange[] = [];
  for (const x of a) {
    for (const y of b) {
      const startMhz = Math.max(x.startMhz, y.startMhz);
      const endMhz = Math.min(x.endMhz, y.endMhz);
      if (endMhz >= startMhz) out.push({ startMhz, endMhz });
    }
  }
  return out.sort((p, q) => p.startMhz - q.startMhz);
}

/** A radio resolved into the integers the search actually works with. */
interface PreparedRadio {
  index: number;
  radio: CoordinationRadio;
  /** Frequencies this radio could take, kHz — its own raster, its own ranges. */
  candidates: number[];
  /** Spacing this radio needs to any other carrier, kHz. */
  spacing: number;
  /** Half its occupied bandwidth, kHz — carriers may never overlap. */
  halfBw: number;
}

/** A frequency already committed to, with the constraints it brings. */
interface Placed {
  khz: number;
  spacing: number;
  halfBw: number;
}

function prepareRadios(radios: CoordinationRadio[], params: CoordinationParams): PreparedRadio[] {
  const guard = toKhz(params.exclusionGuardMhz);
  const exclusions = params.exclusions.map((r) => ({
    lo: toKhz(r.startMhz) - guard,
    hi: toKhz(r.endMhz) + guard,
  }));
  const inExclusion = (khz: number): boolean =>
    exclusions.some((e) => khz >= e.lo && khz <= e.hi);
  const defaultStep = toKhz(params.stepMhz);
  const defaultSpacing = toKhz(params.minSpacingMhz);

  return radios.map((radio, index) => {
    // A radio can only be tuned where its band variant AND the coordination agree.
    const ranges =
      radio.tuningRanges && radio.tuningRanges.length
        ? intersectRanges(params.ranges, radio.tuningRanges)
        : params.ranges;
    const step = radio.tuningStepKhz && radio.tuningStepKhz > 0 ? radio.tuningStepKhz : defaultStep;
    const seen = new Set<number>();
    for (const r of ranges) {
      const lo = toKhz(r.startMhz);
      const hi = toKhz(r.endMhz);
      for (let f = lo; f <= hi; f += step) {
        if (!inExclusion(f)) seen.add(f);
      }
    }
    return {
      index,
      radio,
      candidates: [...seen].sort((a, b) => a - b),
      spacing:
        radio.minSpacingMhz !== undefined ? toKhz(radio.minSpacingMhz) : defaultSpacing,
      halfBw: (radio.occupiedBandwidthKhz ?? 0) / 2,
    };
  });
}

/**
 * Can `f` join `placed` given this radio's own requirements?
 *
 * Between any two carriers the **wider** of the two spacing requirements
 * applies — an SLX-D needing 667 kHz does not get to sit 350 kHz from a ULX-D
 * just because the ULX-D would tolerate it. Separately, the two occupied
 * bandwidths may never overlap, which is a physical floor rather than a
 * coordination preference.
 */
function separationOk(f: number, halfBw: number, spacing: number, placed: Placed[]): boolean {
  for (const p of placed) {
    const sep = Math.abs(f - p.khz);
    if (sep < Math.max(spacing, p.spacing)) return false;
    if (sep < halfBw + p.halfBw) return false;
  }
  return true;
}

/** Order a radio's candidates by one of the restart strategies. */
function orderCandidates(candidates: number[], mode: number, rand: () => number): number[] {
  switch (mode) {
    case 0:
      return spreadOrder(candidates);
    case 1:
      return candidates.slice().sort((a, b) => a - b);
    case 2:
      return candidates.slice().sort((a, b) => b - a);
    default:
      return shuffle(candidates, rand);
  }
}

/** One greedy pass: walk the radios in `order`, give each the first frequency that fits. */
function greedyAssign(
  order: PreparedRadio[],
  locked: Placed[],
  candMode: number,
  rand: () => number,
  params: CoordinationParams
): Map<number, number> {
  const imGuard = toKhz(params.imGuardMhz);
  const placed: Placed[] = [...locked];
  const out = new Map<number, number>();
  for (const r of order) {
    const carriers = placed.map((p) => p.khz);
    for (const f of orderCandidates(r.candidates, candMode, rand)) {
      if (!separationOk(f, r.halfBw, r.spacing, placed)) continue;
      if (!imCompatible(f, carriers, imGuard, params.thirdOrder, params.fifthOrder)) continue;
      out.set(r.index, f);
      placed.push({ khz: f, spacing: r.spacing, halfBw: r.halfBw });
      break;
    }
  }
  return out;
}

/**
 * Place every radio on a uniform grid.
 *
 * Sennheiser EW-D, EW-DX and Digital 6000 coordinate this way rather than
 * searching for an IM-free set, because an equidistant set has no third-order
 * product landing on any member — that is the whole point of the published
 * "min. frequency spacing for equidistant grid" figure. Placing these radios
 * off-grid throws away the property the vendor engineered for, so when every
 * radio in the job asks for it, try the grid first.
 */
function equidistantAssign(
  prepared: PreparedRadio[],
  locked: Placed[],
  params: CoordinationParams
): Map<number, number> | null {
  if (!prepared.length) return null;
  if (!prepared.every((r) => r.radio.strategy === 'equidistant')) return null;

  // One grid must satisfy the widest requirement in the mix.
  const gridStep = Math.max(...prepared.map((r) => r.spacing));
  if (!Number.isFinite(gridStep) || gridStep <= 0) return null;

  const allowed = prepared.map((r) => new Set(r.candidates));
  const starts = [...new Set(prepared.flatMap((r) => r.candidates))].sort((a, b) => a - b);
  const hi = starts.length ? starts[starts.length - 1]! : 0;

  let best: Map<number, number> | null = null;
  for (const start of starts) {
    // Grid points from this offset that at least one radio can use.
    const points: number[] = [];
    for (let f = start; f <= hi; f += gridStep) {
      if (allowed.some((s) => s.has(f))) points.push(f);
    }
    if (points.length < prepared.length) continue;
    if (locked.some((l) => points.some((p) => Math.abs(p - l.khz) < gridStep))) continue;
    // An equidistant set is IM-clean among itself, but a locked carrier that
    // isn't on the grid is not covered by that guarantee — check it explicitly.
    if (
      locked.length &&
      points.some(
        (p) =>
          !imCompatible(
            p,
            locked.map((l) => l.khz),
            toKhz(params.imGuardMhz),
            params.thirdOrder,
            params.fifthOrder
          )
      )
    ) {
      continue;
    }

    // Most-constrained radio first, so a narrow-band unit isn't crowded out.
    const order = prepared
      .slice()
      .sort(
        (a, b) =>
          points.filter((p) => allowed[a.index]!.has(p)).length -
          points.filter((p) => allowed[b.index]!.has(p)).length
      );
    const used = new Set<number>();
    const out = new Map<number, number>();
    for (const r of order) {
      const p = points.find((x) => !used.has(x) && allowed[r.index]!.has(x));
      if (p === undefined) continue;
      used.add(p);
      out.set(r.index, p);
    }
    if (!best || out.size > best.size) best = out;
    if (best.size === prepared.length) break;
  }
  return best;
}

/**
 * Coordinate a heterogeneous set of radios, each with its own tuning ranges,
 * raster and required spacing.
 *
 * This is the entry point that uses real equipment data. {@link coordinate} is
 * the thin homogeneous wrapper over it.
 */
export function coordinateRadios(
  radios: CoordinationRadio[],
  params: CoordinationParams
): CoordinationResult {
  const prepared = prepareRadios(radios, params);
  const locked: Placed[] = params.locked.map((f) => ({
    khz: toKhz(f),
    spacing: toKhz(params.minSpacingMhz),
    halfBw: 0,
  }));
  const candidateCount = new Set(prepared.flatMap((r) => r.candidates)).size;
  const notes: string[] = [];

  const lockedOut: CoordinatedFrequency[] = params.locked.map((f, i) => ({
    name: `Lock ${i + 1}`,
    frequencyMhz: f,
    locked: true,
  }));

  if (!radios.length) {
    return {
      assigned: lockedOut,
      requested: 0,
      placed: 0,
      unplaced: 0,
      candidateCount,
      notes: ['Nothing requested.'],
    };
  }

  const rand = mulberry32((params.seed ?? 1) >>> 0);

  let best = equidistantAssign(prepared, locked, params) ?? new Map<number, number>();
  if (best.size === radios.length) {
    notes.push(
      `Placed all ${radios.length} frequencies on a ${toMhz(
        Math.max(...prepared.map((r) => r.spacing))
      )} MHz equidistant grid, as the equipment expects.`
    );
  }

  if (best.size < radios.length) {
    // Radio orderings: as given, fewest options first, widest spacing first, then shuffles.
    const byOptions = prepared.slice().sort((a, b) => a.candidates.length - b.candidates.length);
    const bySpacing = prepared.slice().sort((a, b) => b.spacing - a.spacing);
    const radioOrders: PreparedRadio[][] = [byOptions, bySpacing, prepared.slice()];
    for (let i = 0; i < 3; i++) radioOrders.push(shuffle(prepared, rand));

    outer: for (const order of radioOrders) {
      for (let candMode = 0; candMode < 6; candMode++) {
        const got = greedyAssign(order, locked, candMode, rand, params);
        if (got.size > best.size) best = got;
        if (best.size >= radios.length) break outer;
      }
    }
    if (best.size === radios.length) notes.push(`Placed all ${radios.length} frequencies.`);
  }

  const assigned: CoordinatedFrequency[] = [
    ...lockedOut,
    ...prepared
      .filter((r) => best.has(r.index))
      .map((r) => ({
        name: r.radio.name,
        frequencyMhz: toMhz(best.get(r.index)!),
        bandCode: r.radio.bandCode,
        modeId: r.radio.modeId,
        requiredSpacingMhz: toMhz(r.spacing),
      }))
      .sort((a, b) => a.frequencyMhz - b.frequencyMhz),
  ];

  const placed = best.size;
  const unplaced = radios.length - placed;
  if (unplaced > 0) {
    const stuck = prepared.filter((r) => !best.has(r.index));
    notes.push(
      `Only ${placed} of ${radios.length} requested frequencies could be placed with the given ranges, ` +
        `spacing and IM settings. Widen the ranges, reduce spacing, or relax IM avoidance.`
    );
    const starved = stuck.filter((r) => r.candidates.length === 0);
    if (starved.length) {
      notes.push(
        `${starved.length === 1 ? 'This radio has' : 'These radios have'} no tunable frequency ` +
          `inside the coordination ranges at all: ${starved
            .map((r) => `${r.radio.name}${r.radio.bandCode ? ` (${r.radio.bandCode})` : ''}`)
            .join(', ')}. Check the band variant against the ranges.`
      );
    }
  }
  if (candidateCount === 0) notes.push('No candidate frequencies — check ranges vs exclusions.');

  return { assigned, requested: radios.length, placed, unplaced, candidateCount, notes };
}

/**
 * Coordinate `count` identical radios using the coordination-wide settings.
 *
 * Kept for callers with no equipment data. Everything it can express is a
 * special case of {@link coordinateRadios}, so it delegates rather than keeping
 * a second search.
 */
export function coordinate(
  count: number,
  params: CoordinationParams,
  names?: string[]
): CoordinationResult {
  if (count <= 0) return coordinateRadios([], params);
  const radios: CoordinationRadio[] = Array.from({ length: count }, (_, i) => ({
    name: names?.[i] ?? `Ch ${i + 1}`,
  }));
  return coordinateRadios(radios, params);
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
