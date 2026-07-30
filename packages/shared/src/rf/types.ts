/**
 * Sourced RF characteristics — the data that coordination is actually based on.
 *
 * The point of this module is that every number carries its provenance. Before
 * it existed, every product in the catalog claimed a flat 200 kHz occupied
 * bandwidth, a 25 kHz tuning raster and a hand-picked "recommended spacing",
 * none of which came from anywhere. Those three assumptions are wrong often
 * enough to matter:
 *
 *   - Occupied bandwidth is NOT the same quantity as required channel spacing.
 *     A Shure PSM 1000 occupies ~200 kHz but Shure's own compatible-frequency
 *     count works out at ~1.9 MHz of practical separation.
 *   - Tuning raster is per-band, not per-product. Shure SLX-D is 25 kHz except
 *     in the JB band, where it is 125 kHz. Wisycom is 5 kHz throughout.
 *   - Required spacing is per-MODE. Shure Axient Digital is 350 kHz in standard
 *     mode and 125 kHz in High Density; Sennheiser EW-DX is 600 kHz standard
 *     and 300 kHz in Link Density.
 *
 * So a product carries a list of {@link BandVariant}s (what it can tune) and a
 * list of {@link RfMode}s (how much room each carrier needs), and both are
 * tagged with where the figure came from.
 */

/**
 * Where a number came from. This is the honesty mechanism — `basis` is the
 * field to check before trusting a value for a live show.
 */
export interface Provenance {
  /**
   * - `vendor-doc`: quoted from the manufacturer's own published documentation.
   * - `derived`: computed from vendor figures (e.g. Carson's rule on a published
   *   deviation, or MHz-per-channel from a published channel count).
   * - `assumed`: no source — a placeholder carried over or a conservative guess.
   */
  basis: 'vendor-doc' | 'derived' | 'assumed';
  /** URL or document title the figure was taken from. */
  source?: string;
  /** ISO date the source was read. */
  retrieved?: string;
  /** How a `derived` figure was computed, or why an `assumed` one was chosen. */
  note?: string;
}

/** True only for figures quoted from the manufacturer's own documentation. */
export function isVendorSourced(p: Provenance | undefined): boolean {
  return p?.basis === 'vendor-doc';
}

/** An inclusive frequency segment, MHz. Mirrors FreqRange in coordination.ts. */
export interface RfRange {
  startMhz: number;
  endMhz: number;
}

/**
 * How a product places carriers relative to one another.
 *
 * - `im-search`: the coordinator must search for a set with no intermodulation
 *   product landing on a carrier. This is what the Shure/WWB model assumes and
 *   what {@link coordinate} does by default.
 * - `equidistant`: carriers sit on a uniform grid whose step is `minSpacingKhz`.
 *   A perfectly equidistant set has no third-order product landing on any
 *   member, which is why Sennheiser EW-D / EW-DX / Digital 6000 coordinate this
 *   way instead of searching. Honouring it is not an optimisation — placing
 *   these radios off-grid gives up the property the vendor designed for.
 */
export type SpacingStrategy = 'im-search' | 'equidistant';

/**
 * One operating mode of a product. Most digital systems ship at least two (a
 * standard mode and a denser one that trades range or audio bandwidth for
 * channel count), and they need materially different spacing.
 */
export interface RfMode {
  /** Stable id, unique within the product, e.g. `standard`, `high-density`. */
  id: string;
  /** Display name as the vendor writes it, e.g. "High Density", "Link Density (LD)". */
  name: string;
  /**
   * Minimum carrier-to-carrier spacing this mode needs, kHz. This — not the
   * occupied bandwidth — is what drives coordination.
   */
  minSpacingKhz: number;
  /** RF footprint of a single carrier, kHz. Undefined when the vendor doesn't publish one. */
  occupiedBandwidthKhz?: number;
  /** How carriers are placed relative to each other in this mode. */
  strategy: SpacingStrategy;
  /** Provenance of `minSpacingKhz`. */
  spacing: Provenance;
  /** Provenance of `occupiedBandwidthKhz`, when present. */
  bandwidth?: Provenance;
  /** Whatever else a coordinator needs to know about this mode. */
  notes?: string;
}

/**
 * One frequency-range variant of a product — the "G51" in ULXD4-G51, the
 * "Q1-9" in EW-DX EM 2 (Q1-9), the "B1" in a Wisycom MCR54.
 *
 * `ranges` is a list, not a single pair, because discontiguous variants are
 * routine rather than exotic: Shure Axient Digital G55/G57/K53/K54 all carry a
 * 608–614 MHz gap, K54 carries a second gap at 616–653, P55 is three separate
 * segments, and every Wisycom MCR54 version is three segments.
 */
export interface BandVariant {
  /** Vendor's band code exactly as printed on the unit, e.g. `G51`, `S1-10`, `B2`. */
  code: string;
  /** The tunable spectrum of this variant, MHz. */
  ranges: RfRange[];
  /**
   * Tuning raster for this variant, kHz — set only when it differs from the
   * product's default (e.g. Shure SLX-D JB tunes in 125 kHz steps, not 25 kHz).
   */
  tuningStepKhz?: number;
  /**
   * Regions the vendor lists this variant for. Omitted where the vendor doesn't
   * tie the code to a region.
   */
  regions?: string[];
  /** Vendor caveats — power limits, indoor-only, country restrictions. */
  notes?: string;
  provenance: Provenance;
}

/** Total tunable width of a variant, MHz (sums the segments, ignoring gaps). */
export function variantWidthMhz(v: BandVariant): number {
  return v.ranges.reduce((sum, r) => sum + (r.endMhz - r.startMhz), 0);
}

/** Does `mhz` fall inside any segment of this variant? */
export function variantContains(v: BandVariant, mhz: number): boolean {
  return v.ranges.some((r) => mhz >= r.startMhz && mhz <= r.endMhz);
}

/** Find a variant by code, case-insensitively. */
export function findVariant(
  variants: BandVariant[] | undefined,
  code: string
): BandVariant | undefined {
  const want = code.trim().toLowerCase();
  return variants?.find((v) => v.code.toLowerCase() === want);
}

/** Find a mode by id, falling back to the first one the product declares. */
export function findMode(modes: RfMode[] | undefined, id?: string): RfMode | undefined {
  if (!modes?.length) return undefined;
  if (!id) return modes[0];
  return modes.find((m) => m.id === id) ?? modes[0];
}

/** Intersect a variant's ranges with the coordination's allowed ranges. */
export function intersectRanges(a: RfRange[], b: RfRange[]): RfRange[] {
  const out: RfRange[] = [];
  for (const x of a) {
    for (const y of b) {
      const startMhz = Math.max(x.startMhz, y.startMhz);
      const endMhz = Math.min(x.endMhz, y.endMhz);
      if (endMhz >= startMhz) out.push({ startMhz, endMhz });
    }
  }
  return out.sort((p, q) => p.startMhz - q.startMhz);
}
