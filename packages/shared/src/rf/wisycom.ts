/**
 * Wisycom band variants and RF modes.
 *
 * Wisycom is where the catalog's two blanket assumptions break hardest:
 *
 *   - **Tuning raster is 5 kHz, not 25 kHz.** Both the MCR54 receiver and the
 *     MTP61 transmitter use a PLL synthesizer with a 5 kHz minimum step.
 *   - **Occupied bandwidth is mode-dependent and well under 200 kHz** —
 *     ~150 kHz wideband, ~100 kHz narrowband, both published by Wisycom.
 *
 * Wisycom also publishes a minimum spacing outright, and it is *tighter* than
 * the placeholder the catalog used to apply: 200 kHz with narrowband modulation
 * and linear transmitters.
 *
 * Sourced from the Wisycom MCR54 datasheet (MCR54-en-b04) and the MTP61 user
 * manual, read 2026-07-30.
 */

import type { BandVariant, Provenance, RfMode } from './types.js';

const RETRIEVED = '2026-07-30';

const MCR54_DATASHEET =
  'Wisycom MCR54 datasheet (MCR54-en-b04) — https://www.raycom.co.uk/wp-content/uploads/2020/05/MCR54-en-b04.pdf';
const MTP61_MANUAL = 'Wisycom MTP61 user manual';

const datasheet: Provenance = {
  basis: 'vendor-doc',
  source: MCR54_DATASHEET,
  retrieved: RETRIEVED,
  note: 'CONFIGURATIONS page, "FREQUENCY RANGE" table.',
};

/**
 * Every MCR54 version is three separate segments — a wide UHF tuning span plus
 * two narrow high-band slices that differ by region.
 */
export const WISYCOM_MCR54_BANDS: BandVariant[] = [
  {
    code: 'B1',
    ranges: [
      { startMhz: 470, endMhz: 800 },
      { startMhz: 960, endMhz: 1000 },
      { startMhz: 1045, endMhz: 1071 },
    ],
    regions: ['UK'],
    notes: '470–800 MHz tunable plus 960–1000 MHz and 1045–1071 MHz (UK DME).',
    provenance: datasheet,
  },
  {
    code: 'B2',
    ranges: [
      { startMhz: 470, endMhz: 800 },
      { startMhz: 823, endMhz: 832 },
      { startMhz: 940, endMhz: 960 },
    ],
    regions: ['US', 'EU'],
    notes: '470–800 MHz tunable plus 823–832 MHz and 940–960 MHz (USA/EU).',
    provenance: datasheet,
  },
  {
    code: 'B3',
    ranges: [
      { startMhz: 470, endMhz: 800 },
      { startMhz: 806, endMhz: 809 },
      { startMhz: 1240, endMhz: 1260 },
    ],
    regions: ['JP'],
    notes: '470–800 MHz tunable plus 806–809 MHz and 1240–1260 MHz (JP).',
    provenance: datasheet,
  },
];

export const WISYCOM_MODES: RfMode[] = [
  {
    id: 'narrowband',
    name: 'Narrowband',
    minSpacingKhz: 200,
    occupiedBandwidthKhz: 100,
    strategy: 'im-search',
    spacing: {
      basis: 'vendor-doc',
      source: MCR54_DATASHEET,
      retrieved: RETRIEVED,
      note:
        'Wisycom: "With the combination of Narrowband Modulation and Linear transmitters, set ' +
        'your channels every 200kHz without intermodulation distortion and get an extra 3dB ' +
        'sensitivity." Note the condition — this figure assumes linear transmitters.',
    },
    bandwidth: {
      basis: 'vendor-doc',
      source: MTP61_MANUAL,
      retrieved: RETRIEVED,
      note:
        'MTP61: "When set to NarrowBand, the audio bandwidth is limited to 17 kHz and the peak ' +
        'deviation is set to ±35 kHz so that the occupied bandwidth is approximately 100 kHz."',
    },
    notes: 'Requires narrowband modulation AND linear transmitters for the 200 kHz figure to hold.',
  },
  {
    id: 'wideband',
    name: 'Wideband',
    minSpacingKhz: 350,
    occupiedBandwidthKhz: 150,
    strategy: 'im-search',
    spacing: {
      basis: 'assumed',
      source: MCR54_DATASHEET,
      retrieved: RETRIEVED,
      note:
        'Wisycom publishes the 200 kHz figure only for the narrowband + linear-transmitter ' +
        'case. No wideband spacing is published; 350 kHz is carried over as a conservative ' +
        'working figure. VERIFY.',
    },
    bandwidth: {
      basis: 'vendor-doc',
      source: MTP61_MANUAL,
      retrieved: RETRIEVED,
      note:
        'MTP61: "When set to WideBand, the audio bandwidth is limited to 20 kHz and the peak ' +
        'deviation is set to ±56 kHz so that the occupied bandwidth is approximately 150 kHz."',
    },
  },
];

/** Wisycom's tuning raster — 5 kHz, not the 25 kHz assumed for everything else. */
export const WISYCOM_TUNING_STEP_KHZ = 5;

export const WISYCOM_STEP_PROVENANCE: Provenance = {
  basis: 'vendor-doc',
  source: `${MCR54_DATASHEET}; ${MTP61_MANUAL}`,
  retrieved: RETRIEVED,
  note:
    'MCR54: "microprocessor controlled frequency synthesizer circuit with 5 kHz minimum step", ' +
    '2400 user-programmable frequencies in 40 groups of 60. MTP61: quartz PLL with 5 kHz step.',
};
