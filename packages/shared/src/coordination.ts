/**
 * Frequency-coordination domain model.
 *
 * Coordination = pick a set of carrier frequencies that are mutually
 * compatible: adequately spaced, clear of excluded spectrum (TV/DTT,
 * existing licensees, guard bands), and free of intermodulation (IM)
 * products landing on or near any carrier. Third-order IM (2·f1−f2 and
 * f1+f2−f3) is the dominant problem for wireless mics; fifth-order is a
 * finer pass.
 */

/** An inclusive frequency segment [startMhz, endMhz]. */
export interface FreqRange {
  startMhz: number;
  endMhz: number;
}

export interface CoordinationParams {
  /** Allowed tuning ranges (e.g. clear UHF segments between DTT muxes). */
  ranges: FreqRange[];
  /** Candidate grid step, MHz (Ofcom/most tools use 25 kHz raster → 0.025). */
  stepMhz: number;
  /** Minimum spacing between any two carriers, MHz. */
  minSpacingMhz: number;
  /** A carrier must sit at least this far from any excluded region, MHz. */
  exclusionGuardMhz: number;
  /** Guard window around a carrier that an IM product must avoid, MHz. */
  imGuardMhz: number;
  /** Avoid third-order IM (2·f1−f2, f1+f2−f3). */
  thirdOrder: boolean;
  /** Avoid (two-transmitter) fifth-order IM (3·f1−2·f2). */
  fifthOrder: boolean;
  /** Excluded regions (existing users, DTT, reserved), MHz. */
  exclusions: FreqRange[];
  /** Already-in-use frequencies the new set must stay compatible with, MHz. */
  locked: number[];
  /**
   * Deterministic seed for the restart heuristic, so identical requests give
   * identical results. Defaults to a fixed value.
   */
  seed?: number;
}

export interface CoordinatedFrequency {
  name: string;
  frequencyMhz: number;
  /** True if this was a pre-locked/existing frequency, not newly assigned. */
  locked?: boolean;
}

export interface CoordinationResult {
  assigned: CoordinatedFrequency[];
  requested: number;
  placed: number;
  unplaced: number;
  /** Total candidate grid points considered. */
  candidateCount: number;
  notes: string[];
}

export type ConflictKind =
  | 'spacing'
  | 'exclusion'
  | 'out-of-range'
  | 'im3-2tx'
  | 'im3-3tx'
  | 'im5-2tx';

export interface Conflict {
  kind: ConflictKind;
  /** Frequencies (MHz) involved in the conflict. */
  frequencies: number[];
  /** The offending value (an IM product, or the carrier for spacing/exclusion). */
  atMhz: number;
  message: string;
}

export interface AnalysisResult {
  frequencyCount: number;
  conflicts: Conflict[];
  ok: boolean;
}

/** Sensible UK UHF PMSE defaults (channel 38 clearance + typical settings). */
export function defaultCoordinationParams(): CoordinationParams {
  return {
    // UHF "channel 38" (606.5–614 MHz) is the UK's shared, licence-exempt-ish
    // coordination band; a reasonable default working range.
    ranges: [{ startMhz: 606.5, endMhz: 614.0 }],
    stepMhz: 0.025,
    minSpacingMhz: 0.4,
    exclusionGuardMhz: 0.1,
    imGuardMhz: 0.05,
    thirdOrder: true,
    fifthOrder: false,
    exclusions: [],
    locked: [],
    seed: 1,
  };
}
