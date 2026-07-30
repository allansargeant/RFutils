/**
 * The sourced-RF registry: plugin id → band variants + operating modes.
 *
 * Kept separate from `plugins.ts` so the citations live next to the data and a
 * product's control descriptor stays readable. `plugins.ts` merges these in.
 *
 * Coverage is deliberately partial. Shure, Sennheiser, Lectrosonics and Wisycom
 * have been researched against vendor documentation; the remaining products in
 * the catalog have no entry here and keep their original placeholder numbers,
 * which is why `rfDataFor()` returning `undefined` is a meaningful answer rather
 * than an error — see `UNSOURCED_PRODUCTS`.
 */

import type { BandVariant, RfMode } from './types.js';
import {
  SHURE_AD_BANDS,
  SHURE_AD_MODES,
  SHURE_PSM1000_BANDS,
  SHURE_PSM1000_MODES,
  SHURE_QLXD_BANDS,
  SHURE_QLXD_MODES,
  SHURE_SLXD_BANDS,
  SHURE_SLXD_MODES,
  SHURE_ULXD_BANDS,
  SHURE_ULXD_MODES,
} from './shure.js';
import {
  SENN_2000_BANDS,
  SENN_2000_MODES,
  SENN_D6000_BANDS,
  SENN_D6000_MODES,
  SENN_D9000_BANDS,
  SENN_D9000_MODES,
  SENN_EW100_G4_BANDS,
  SENN_EW300_500_G4_BANDS,
  SENN_EWD_BANDS,
  SENN_EWD_MODES,
  SENN_EWDX_BANDS,
  SENN_EWDX_MODES,
  SENN_EW_G4_MODES,
  SENN_IEM_G4_BANDS,
  SENN_IEM_G4_MODES,
} from './sennheiser.js';
import { LECTRO_BANDS, LECTRO_DSQD_RANGE, LECTRO_MODES } from './lectrosonics.js';
import {
  WISYCOM_MCR54_BANDS,
  WISYCOM_MODES,
  WISYCOM_TUNING_STEP_KHZ,
} from './wisycom.js';

export * from './types.js';
export * from './shure.js';
export * from './sennheiser.js';
export * from './lectrosonics.js';
export * from './wisycom.js';

/** Everything the coordination engine needs to know about one product's RF. */
export interface ProductRfData {
  /** Frequency-range variants the product is sold in. */
  bandVariants: BandVariant[];
  /** Operating modes, each with its own required spacing. First is the default. */
  modes: RfMode[];
  /** Default tuning raster, kHz. A BandVariant may override it. */
  tuningStepKhz: number;
}

/**
 * DSQD tunes a narrower span than the full Lectrosonics band set, so its
 * variants are the SRc bands clipped to what the DSQD front end covers.
 */
const DSQD_BANDS: BandVariant[] = LECTRO_BANDS.filter((v) =>
  v.ranges.some(
    (r) => r.startMhz < LECTRO_DSQD_RANGE.endMhz && r.endMhz > LECTRO_DSQD_RANGE.startMhz
  )
).map((v) => ({
  ...v,
  ranges: v.ranges
    .map((r) => ({
      startMhz: Math.max(r.startMhz, LECTRO_DSQD_RANGE.startMhz),
      endMhz: Math.min(r.endMhz, LECTRO_DSQD_RANGE.endMhz),
    }))
    .filter((r) => r.endMhz > r.startMhz),
  notes: [v.notes, 'Clipped to the DSQD front end (470.100–614.375 MHz).']
    .filter(Boolean)
    .join(' '),
}));

/** plugin id → researched RF data. */
export const PRODUCT_RF_DATA: Record<string, ProductRfData> = {
  'shure-axient-digital': {
    bandVariants: SHURE_AD_BANDS,
    modes: SHURE_AD_MODES,
    tuningStepKhz: 25,
  },
  'shure-ulxd': { bandVariants: SHURE_ULXD_BANDS, modes: SHURE_ULXD_MODES, tuningStepKhz: 25 },
  'shure-qlxd': { bandVariants: SHURE_QLXD_BANDS, modes: SHURE_QLXD_MODES, tuningStepKhz: 25 },
  'shure-slxd': { bandVariants: SHURE_SLXD_BANDS, modes: SHURE_SLXD_MODES, tuningStepKhz: 25 },
  'shure-psm1000': {
    bandVariants: SHURE_PSM1000_BANDS,
    modes: SHURE_PSM1000_MODES,
    tuningStepKhz: 25,
  },

  'sennheiser-ewdx': { bandVariants: SENN_EWDX_BANDS, modes: SENN_EWDX_MODES, tuningStepKhz: 25 },
  'sennheiser-ewd': { bandVariants: SENN_EWD_BANDS, modes: SENN_EWD_MODES, tuningStepKhz: 25 },
  'sennheiser-d6000': {
    bandVariants: SENN_D6000_BANDS,
    modes: SENN_D6000_MODES,
    tuningStepKhz: 25,
  },
  'sennheiser-d9000': {
    bandVariants: SENN_D9000_BANDS,
    modes: SENN_D9000_MODES,
    tuningStepKhz: 25,
  },
  'sennheiser-ew-g4': {
    // Both G4 receiver classes, since a single catalog entry covers the family.
    bandVariants: [...SENN_EW100_G4_BANDS, ...SENN_EW300_500_G4_BANDS].filter(
      (v, i, all) => all.findIndex((x) => x.code === v.code) === i
    ),
    modes: SENN_EW_G4_MODES,
    tuningStepKhz: 25,
  },
  'sennheiser-iem-g4': {
    bandVariants: SENN_IEM_G4_BANDS,
    modes: SENN_IEM_G4_MODES,
    tuningStepKhz: 25,
  },
  'sennheiser-2000': { bandVariants: SENN_2000_BANDS, modes: SENN_2000_MODES, tuningStepKhz: 25 },

  'lectrosonics-dsqd': {
    bandVariants: DSQD_BANDS,
    modes: LECTRO_MODES,
    // Selectable 25 kHz or 100 kHz; 25 kHz is the modern default.
    tuningStepKhz: 25,
  },

  'wisycom-mcr54': {
    bandVariants: WISYCOM_MCR54_BANDS,
    modes: WISYCOM_MODES,
    tuningStepKhz: WISYCOM_TUNING_STEP_KHZ,
  },
};

/**
 * Products still carrying unsourced placeholder numbers. Listed explicitly so
 * the gap is visible in the UI and in tests rather than being indistinguishable
 * from researched data.
 */
export const UNSOURCED_PRODUCTS = [
  'shure-glxd',
  'sounddevices-a20',
  'audioltd-a10',
  'sony-dwx',
  'mipro-act',
  'dpa-nseries',
  'deity-theos',
  'audiotechnica-5000',
] as const;

/** Researched RF data for a product, or undefined if it has none yet. */
export function rfDataFor(pluginId: string): ProductRfData | undefined {
  return PRODUCT_RF_DATA[pluginId];
}

/** Has this product been researched against vendor documentation at all? */
export function isResearched(pluginId: string): boolean {
  return pluginId in PRODUCT_RF_DATA;
}
