/**
 * Sennheiser band variants and RF modes.
 *
 * Sennheiser's digital systems do not coordinate by searching for an
 * IM-free set — they place carriers on a uniform grid, because an equidistant
 * set has no third-order product landing on any member. The vendor publishes
 * that grid spacing directly ("Min. frequency spacing for equidistant grid"),
 * which makes these the best-sourced spacing figures in the whole catalog.
 * Their `strategy` is `equidistant` for exactly that reason.
 *
 * Ranges are quoted from docs.cloud.sennheiser.com, read 2026-07-30.
 */

import type { BandVariant, Provenance, RfMode } from './types.js';

const RETRIEVED = '2026-07-30';

const EWD_SPECS =
  'https://docs.cloud.sennheiser.com/en-us/ew-d/ew-d/specifications-system.html';
const EWDX_PRODUCT =
  'https://www.sennheiser.com/en-us/catalog/products/wireless-systems/ew-dx-em-2/ew-dx-em-2-q1-9-509342';
const EWD_PRODUCT =
  'https://www.sennheiser.com/en-us/catalog/products/wireless-systems/ew-d-em/ew-d-em-q1-6-508800';
const D6000_SYSTEM =
  'https://docs.cloud.sennheiser.com/en-us/digital-6000/digital-6000/specs-system.html';
const D6000_SKM =
  'https://docs.cloud.sennheiser.com/en-us/digital-6000/digital-6000/info-skm6000.html';
const G4_EM100 =
  'https://docs.cloud.sennheiser.com/en-us/ew-g4/ew-g4/specifications-em100g4.html';
const G4_EM300500 =
  'https://docs.cloud.sennheiser.com/en-us/ew-g4/ew-g4/specifications-em300-500g4.html';
const IEMG4_SR =
  'https://docs.cloud.sennheiser.com/en-us/ew-iem-g4/ew-iem-g4/ew-iem-g4-sr-technical-data.html';

const doc = (source: string, note?: string): Provenance => ({
  basis: 'vendor-doc',
  source,
  retrieved: RETRIEVED,
  note,
});

/** Build variants from a compact [code, segments, notes?] table. */
function variants(
  rows: [string, number[][], string?][],
  provenance: Provenance
): BandVariant[] {
  return rows.map(([code, ranges, notes]) => ({
    code,
    ranges: ranges.map(([startMhz, endMhz]) => ({ startMhz: startMhz!, endMhz: endMhz! })),
    notes,
    provenance,
  }));
}

// ---------------------------------------------------------------------------
// EW-DX
// ---------------------------------------------------------------------------

export const SENN_EWDX_MODES: RfMode[] = [
  {
    id: 'standard',
    name: 'Standard',
    minSpacingKhz: 600,
    strategy: 'equidistant',
    spacing: doc(
      EWDX_PRODUCT,
      'Sennheiser: "Equidistant channel spacing … Standard Mode with 600 kHz spacing for up ' +
        'to 146 channels" across an 88 MHz switching bandwidth.'
    ),
    notes: 'Up to 88 MHz switching bandwidth; up to 146 channels in Standard mode.',
  },
  {
    id: 'link-density',
    name: 'Link Density (LD)',
    minSpacingKhz: 300,
    strategy: 'equidistant',
    spacing: doc(
      EWDX_PRODUCT,
      'Sennheiser: "Link Density (LD) Mode with 300 kHz spacing for up to 293 channels".'
    ),
    notes: 'Doubles channel count to 293 across the same 88 MHz.',
  },
];

export const SENN_EWDX_BANDS: BandVariant[] = variants(
  [
    ['Q1-9', [[470.2, 550]]],
    ['R1-9', [[520, 607.8]]],
    ['S1-10', [[606.2, 693.8]]],
    ['S2-10', [[614.2, 693.8]]],
    ['S4-10', [[630, 693.8]]],
    ['U1/5', [[823.2, 831.8], [863.2, 864.8]]],
    ['V3-4', [[925.2, 937.3]]],
    ['V5-7', [[941.7, 951.8], [953.05, 956.05], [956.65, 959.65]]],
    ['W5-6', [[1240.1, 1251.875], [1253.125, 1259.9]]],
    ['Y1-3', [[1785.2, 1799.8]]],
  ],
  doc(EWD_SPECS, 'Table "Audio-Link EW-DX frequency ranges", doc version v6.0 | 06/2026.')
);

// ---------------------------------------------------------------------------
// EW-D / EW-DP
// ---------------------------------------------------------------------------

export const SENN_EWD_MODES: RfMode[] = [
  {
    id: 'standard',
    name: 'Standard',
    minSpacingKhz: 600,
    strategy: 'equidistant',
    spacing: doc(
      EWD_PRODUCT,
      'Sennheiser: "Elimination of intermodulation enables channels to be placed in an ' +
        'equidistant tuning grid 600 kHz apart"; "56 MHz of tuning bandwidth and equidistant ' +
        'spacing enables up to 90 channels".'
    ),
    notes: '56 MHz tuning bandwidth, up to 90 channels. EW-D has no denser mode.',
  },
];

export const SENN_EWD_BANDS: BandVariant[] = variants(
  [
    ['Q1-6', [[470.2, 526]]],
    ['R1-6', [[520, 576]]],
    ['R4-9', [[552, 607.8]]],
    ['S1-7', [[606.2, 662]]],
    ['S4-7', [[630, 662]]],
    ['S7-10', [[662, 693.8]]],
    ['T1/7', [[694.5, 702.7], [748.3, 757.7]]],
    ['T12', [[806.125, 809.75]]],
    ['T13-14', [[819.2, 823]]],
    ['U1/5', [[823.2, 831.8], [863.2, 864.8]]],
    ['V3-4', [[925.2, 937.3]]],
    ['Y1-3', [[1785.2, 1799.8]]],
  ],
  doc(EWD_SPECS, 'Table "Audio link frequency ranges for EW-D, EW-DP", doc version v6.0 | 06/2026.')
);

// ---------------------------------------------------------------------------
// Digital 6000
// ---------------------------------------------------------------------------

export const SENN_D6000_MODES: RfMode[] = [
  {
    id: 'lr',
    name: 'LR (Long Range)',
    minSpacingKhz: 400,
    strategy: 'equidistant',
    spacing: doc(
      D6000_SYSTEM,
      'Sennheiser: "LR mode (Long Range): Min. frequency spacing for equidistant grid: 400 kHz".'
    ),
    notes: 'SeDAC codec. Digital 9000 transmitters are compatible with Digital 6000 in LR mode.',
  },
  {
    id: 'ld',
    name: 'LD (Link Density)',
    minSpacingKhz: 200,
    strategy: 'equidistant',
    spacing: doc(
      D6000_SYSTEM,
      'Sennheiser: "LD mode (Link Density): Min. frequency spacing for equidistant grid: 200 kHz".'
    ),
    notes: 'SePAC codec; audio response narrows to 30 Hz – 14 kHz.',
  },
];

export const SENN_D6000_BANDS: BandVariant[] = variants(
  [
    ['A1-A4', [[470.2, 558]]],
    ['A5-A8', [[550, 638]]],
    ['B1-B4', [[630, 718]]],
    ['A5-A8 US', [[550, 607.8]], 'US variant, article no. 506367.'],
    ['A1-A4 JP', [[470.15, 558]], 'Japan variant, article no. 506337.'],
    ['A5-A8 JP', [[550, 638]], 'Japan variant, article no. 506338.'],
    ['B1-B4 JP', [[630, 713.85]], 'Japan variant, article no. 506339.'],
    ['A1-A4 KO', [[470.1, 558]], 'Korea variant, article no. 506352.'],
    ['A5-A8 KO', [[550, 638]], 'Korea variant, article no. 506353.'],
    ['B1-B4 KO', [[630, 697.9]], 'Korea variant, article no. 506354.'],
  ],
  doc(
    D6000_SKM,
    'SKM 6000 frequency variants. The receiver (EM 6000) tunes the whole 470–714 MHz; the ' +
      'transmitter variants above are what actually constrain a coordination.'
  )
);

// ---------------------------------------------------------------------------
// Digital 9000
// ---------------------------------------------------------------------------

export const SENN_D9000_MODES: RfMode[] = [
  {
    id: 'lr',
    name: 'LR (Long Range)',
    minSpacingKhz: 400,
    strategy: 'equidistant',
    spacing: {
      basis: 'derived',
      source:
        'https://docs.cloud.sennheiser.com/en-us/digital-6000/digital-6000/info-accessories-d9000.html',
      retrieved: RETRIEVED,
      note:
        'Sennheiser states the SK 9000 and SKM 9000 "are compatible with the Digital 6000 ' +
        'series if operated in LR mode", and Digital 6000 LR mode specifies a 400 kHz minimum ' +
        'equidistant grid. Sennheiser does not publish a Digital 9000 spacing figure directly.',
    },
  },
  {
    id: 'hd',
    name: 'HD (uncompressed)',
    minSpacingKhz: 600,
    strategy: 'equidistant',
    spacing: {
      basis: 'assumed',
      retrieved: RETRIEVED,
      note:
        'Digital 9000 HD mode transmits uncompressed audio and therefore occupies more ' +
        'spectrum than LR, but no spacing figure could be sourced. 600 kHz is a conservative ' +
        'placeholder — VERIFY before relying on it.',
    },
  },
];

export const SENN_D9000_BANDS: BandVariant[] = [
  {
    code: 'A1-A4',
    ranges: [{ startMhz: 470.2, endMhz: 558 }],
    provenance: doc(
      'https://www.sennheiser.com/en-us/catalog/products/wireless-systems/skm-9000/skm-9000-bk-a1-a4-504718',
      'Sennheiser catalog page, "Frequency range 470.200 - 558.000".'
    ),
  },
  {
    code: 'A5-A8',
    ranges: [{ startMhz: 550, endMhz: 638 }],
    provenance: {
      basis: 'assumed',
      retrieved: RETRIEVED,
      note:
        'Matches the Digital 6000 A5-A8 split and is widely listed by dealers, but no ' +
        'Sennheiser-published page for this variant could be reached. VERIFY.',
    },
  },
  {
    code: 'B1-B4',
    ranges: [{ startMhz: 630, endMhz: 718 }],
    provenance: {
      basis: 'assumed',
      retrieved: RETRIEVED,
      note:
        'Matches the Digital 6000 B1-B4 split and is widely listed by dealers, but no ' +
        'Sennheiser-published page for this variant could be reached. VERIFY.',
    },
  },
];

// ---------------------------------------------------------------------------
// evolution wireless G4 — analog wideband FM
// ---------------------------------------------------------------------------

/**
 * G4 is analog FM with HDX companding, and Sennheiser publishes no minimum
 * spacing for it — only the factory preset banks ("20 frequency banks, each
 * with up to 12 factory-preset channels, no intermodulation"). Those banks are
 * the vendor's own coordination answer, but they describe a whole-bank layout,
 * not an adjacent-channel minimum, so the spacing below is explicitly assumed.
 */
export const SENN_EW_G4_MODES: RfMode[] = [
  {
    id: 'standard',
    name: 'Standard',
    minSpacingKhz: 400,
    occupiedBandwidthKhz: 126,
    strategy: 'im-search',
    spacing: {
      basis: 'assumed',
      source: `Sennheiser EM 100 G4 / EM 300-500 G4 specifications — ${G4_EM100}`,
      retrieved: RETRIEVED,
      note:
        'Sennheiser publishes no minimum channel spacing for G4. What it does publish is the ' +
        'preset-bank density: ew 100 G4 gives 12 IM-free channels per 42 MHz switching ' +
        'bandwidth, ew 300-500 G4 gives 32 per 88 MHz. 400 kHz is a conservative working ' +
        'figure for an analog FM system — VERIFY against your own coordination.',
    },
    bandwidth: {
      basis: 'derived',
      source: `Sennheiser EM 100 G4 specifications — ${G4_EM100}`,
      retrieved: RETRIEVED,
      note:
        "Carson's rule on the published peak deviation: ±48 kHz with a 15 kHz audio bandwidth " +
        '→ 2 × (48 + 15) = 126 kHz. Sennheiser publishes deviation, not occupied bandwidth.',
    },
  },
];

/** ew 100 G4 class — 42 MHz switching bandwidth, 1680 frequencies in 25 kHz steps. */
export const SENN_EW100_G4_BANDS: BandVariant[] = variants(
  [
    ['A1', [[470, 516]]],
    ['A', [[516, 558]]],
    ['AS', [[520, 558]]],
    ['G', [[566, 608]]],
    ['GB', [[606, 648]]],
    ['B', [[626, 668]]],
    ['C', [[734, 776]]],
    ['C-TH', [[748.2, 757.8]]],
    ['D', [[780, 822]]],
    ['E', [[823, 865]]],
    ['JB', [[806, 810]]],
    ['K+', [[925, 937.5]]],
    ['1G8', [[1785, 1800]]],
  ],
  doc(G4_EM100, 'EM 100 G4 "Receiving frequency ranges", doc version v1.2 | 05/2026.')
);

/** ew 300 / ew 500 G4 class — 88 MHz switching bandwidth, 2880 frequencies. */
export const SENN_EW300_500_G4_BANDS: BandVariant[] = variants(
  [
    ['Aw+', [[470, 558]]],
    ['AS', [[520, 558]]],
    ['Gw1', [[558, 608]]],
    ['Gw', [[558, 626]]],
    ['GBw', [[606, 678]]],
    ['Bw', [[526, 698]]],
    ['Cw', [[718, 790]]],
    ['Cw-TH', [[748.2, 757.8]]],
    ['Dw', [[790, 865]]],
    ['JB', [[806, 810]]],
    ['K+', [[925, 937.5]]],
  ],
  doc(G4_EM300500, 'EM 300-500 G4 "Receiving frequency ranges", doc version v1.2 | 05/2026.')
);

// ---------------------------------------------------------------------------
// ew IEM G4
// ---------------------------------------------------------------------------

export const SENN_IEM_G4_MODES: RfMode[] = [
  {
    id: 'standard',
    name: 'Standard',
    minSpacingKhz: 400,
    occupiedBandwidthKhz: 202,
    strategy: 'im-search',
    spacing: {
      basis: 'assumed',
      source: `Sennheiser SR IEM G4 specifications — ${IEMG4_SR}`,
      retrieved: RETRIEVED,
      note:
        'Sennheiser publishes "20 frequency banks, each with up to 16 factory-preset channels, ' +
        'no intermodulation" over a 42 MHz switching bandwidth, but no minimum spacing. ' +
        '400 kHz is a conservative working figure — VERIFY.',
    },
    bandwidth: {
      basis: 'derived',
      source: `Sennheiser SR IEM G4 specifications — ${IEMG4_SR}`,
      retrieved: RETRIEVED,
      note:
        "Carson's rule on FM MPX stereo: ±48 kHz peak deviation with a 53 kHz MPX baseband " +
        '→ 2 × (48 + 53) = 202 kHz. Same physics as the Shure PSM 1000.',
    },
  },
];

export const SENN_IEM_G4_BANDS: BandVariant[] = variants(
  [
    ['A1', [[470, 516]]],
    ['A', [[516, 558]]],
    ['AS', [[520, 558]]],
    ['G', [[566, 608]]],
    ['GB', [[606, 648]]],
    ['B', [[626, 668]]],
    ['C', [[734, 776]]],
    ['C-TH', [[748.2, 757.8]]],
    ['D', [[780, 822]]],
    ['E', [[823, 865]]],
  ],
  doc(IEMG4_SR, 'SR IEM G4 "Frequency ranges", doc version v3.3 | 05/2026.')
);

// ---------------------------------------------------------------------------
// 2000 series
// ---------------------------------------------------------------------------

/**
 * The 2000 series is discontinued and its documentation is no longer on
 * Sennheiser's live docs site. Only the switching bandwidth and raster could be
 * sourced; the range codes could not, so none are listed rather than listing
 * guesses. Coordinate it by entering ranges manually.
 */
export const SENN_2000_MODES: RfMode[] = [
  {
    id: 'standard',
    name: 'Standard',
    minSpacingKhz: 400,
    occupiedBandwidthKhz: 126,
    strategy: 'im-search',
    spacing: {
      basis: 'assumed',
      retrieved: RETRIEVED,
      note:
        'No Sennheiser-published spacing figure for the 2000 series could be reached. The ' +
        'series is analog FM like G4, so the same conservative 400 kHz is used. VERIFY.',
    },
    bandwidth: {
      basis: 'assumed',
      retrieved: RETRIEVED,
      note: 'Assumed equal to G4 (analog FM, same era and modulation family). VERIFY.',
    },
  },
];

export const SENN_2000_BANDS: BandVariant[] = [];
