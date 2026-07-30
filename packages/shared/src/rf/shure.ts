/**
 * Shure band variants and RF modes.
 *
 * Every range below is quoted from the "Frequency Range and Transmitter Output
 * Power" / "Receiver Frequency Bands" table in Shure's own user guide for that
 * product. Read 2026-07-30.
 *
 * Note how many of these are discontiguous. That is the reason `ranges` is a
 * list: G55, G57, K53 and K54 on Axient Digital each carry the 608–614 MHz gap,
 * K54 carries a second one at 616–653, P55 is three separate segments, and
 * SLX-D J52 and M55, QLX-D S50 and X53, and PSM 1000 J8A and L8A are all split
 * too. A single start/end pair would silently hand out frequencies inside a gap
 * the radio cannot tune.
 */

import type { BandVariant, Provenance, RfMode } from './types.js';

const RETRIEVED = '2026-07-30';

const guide = (product: string, url: string): Provenance => ({
  basis: 'vendor-doc',
  source: `Shure ${product} user guide — ${url}`,
  retrieved: RETRIEVED,
});

const AD_GUIDE = 'https://www.shure.com/en-US/docs/guide/AD4D';
const ULXD_GUIDE = 'https://www.shure.com/en-US/docs/guide/ULXD';
const QLXD_GUIDE = 'https://www.shure.com/en-US/docs/guide/QLXD';
const SLXD_GUIDE = 'https://www.shure.com/en-US/docs/guide/SLXD';
const PSM1000_GUIDE = 'https://www.shure.com/en-US/docs/guide/PSM1000';

// ---------------------------------------------------------------------------
// Axient Digital
// ---------------------------------------------------------------------------

/**
 * Shure publishes an explicit "Channel-to-Channel Spacing" figure for Axient
 * Digital — the only product in this catalog where the minimum spacing is
 * stated outright rather than having to be inferred from a channel count.
 */
export const SHURE_AD_MODES: RfMode[] = [
  {
    id: 'standard',
    name: 'Standard',
    minSpacingKhz: 350,
    strategy: 'im-search',
    spacing: guide('AD4D', AD_GUIDE),
    notes: 'Shure: "Channel-to-Channel Spacing — Standard Mode 350 kHz" (varies by region).',
  },
  {
    id: 'high-density',
    name: 'High Density',
    minSpacingKhz: 125,
    strategy: 'im-search',
    spacing: guide('AD4D', AD_GUIDE),
    notes:
      'Shure: "Channel-to-Channel Spacing — High Density Mode 125 kHz" (varies by region). ' +
      'HD trades transmitter range and RF power headroom for channel count.',
  },
];

export const SHURE_AD_BANDS: BandVariant[] = (
  [
    ['G53', [[470, 510]]],
    ['G54', [[479, 565]]],
    ['G55', [[470, 608], [614, 636]], 'Operation mode varies by region; Brazil uses High Density mode; max power for Peru is 10 mW.'],
    ['G56', [[470, 636]]],
    ['G57', [[470, 608], [614, 616]], 'G57 alone is 470–608. Selecting G57+ adds 614–616 MHz, limited to 10 mW.'],
    ['G62', [[510, 530]]],
    ['H54', [[520, 636]]],
    ['K53', [[606, 608], [614, 698]]],
    ['K54', [[606, 608], [614, 616], [653, 663]], 'Gaps at 608–614 and 616–653 MHz.'],
    ['K55', [[606, 694]]],
    ['K56', [[606, 714]]],
    ['K57', [[606, 790]]],
    ['K58', [[622, 698]]],
    ['L54', [[630, 787]]],
    ['L60', [[630.125, 697.875]]],
    ['P55', [[694, 703], [748, 758], [803, 806]]],
    ['R52', [[794, 806]]],
    ['JB', [[806, 810]]],
    ['X51', [[925, 937.5]]],
    ['X55', [[941, 960]]],
    ['Z16', [[1240, 1260]], 'Japan only.'],
  ] as [string, number[][], string?][]
).map(([code, ranges, notes]) => ({
  code,
  ranges: ranges.map(([startMhz, endMhz]) => ({ startMhz: startMhz!, endMhz: endMhz! })),
  notes,
  provenance: guide('AD4D', AD_GUIDE),
}));

// ---------------------------------------------------------------------------
// ULX-D
// ---------------------------------------------------------------------------

export const SHURE_ULXD_MODES: RfMode[] = [
  {
    id: 'standard',
    name: 'Standard',
    minSpacingKhz: 350,
    occupiedBandwidthKhz: 200,
    strategy: 'im-search',
    spacing: {
      basis: 'derived',
      source: `Shure ULX-D user guide — ${ULXD_GUIDE}`,
      retrieved: RETRIEVED,
      note:
        'Shure states "17 active transmitters in one 6 MHz TV channel" and "22 active ' +
        'transmitters in one 8 MHz TV channel" → 6000/17 = 353 kHz and 8000/22 = 364 kHz. ' +
        '350 kHz is taken as the working figure, matching the value Shure states outright ' +
        'for Axient Digital standard mode.',
    },
    bandwidth: {
      basis: 'vendor-doc',
      source: `Shure ULX-D user guide — ${ULXD_GUIDE}`,
      retrieved: RETRIEVED,
      note: 'ULXD1/ULXD2 RF OUTPUT section: "Occupied Bandwidth <200 kHz".',
    },
  },
  {
    id: 'high-density',
    name: 'High Density',
    minSpacingKhz: 125,
    occupiedBandwidthKhz: 200,
    strategy: 'im-search',
    spacing: {
      basis: 'derived',
      source: `Shure ULX-D user guide — ${ULXD_GUIDE}`,
      retrieved: RETRIEVED,
      note:
        'Shure states High Density mode gives "up to 47 active transmitters in one 6 MHz TV ' +
        'channel (63 in one 8 MHz TV channel)" → 128 kHz and 127 kHz respectively.',
    },
    bandwidth: {
      basis: 'vendor-doc',
      source: `Shure ULX-D user guide — ${ULXD_GUIDE}`,
      retrieved: RETRIEVED,
      note: 'Occupied bandwidth is specified for the transmitter, not per mode.',
    },
  },
];

export const SHURE_ULXD_BANDS: BandVariant[] = (
  [
    ['G50', [[470, 534]]],
    ['G51', [[470, 534]]],
    ['G52', [[479, 534]]],
    ['G53', [[470, 510]]],
    ['G54', [[479, 565]], 'Wide-tuning: ULXD1, ULXD2, ULXD4D and ULXD4Q only.'],
    ['G55', [[470, 608], [614, 636]], 'Wide-tuning. Operation mode varies by region; max power for Peru is 10 mW.'],
    ['G56', [[470, 636]], 'Wide-tuning: ULXD1, ULXD2, ULXD4D and ULXD4Q only.'],
    ['G57', [[470, 608]], 'Wide-tuning: ULXD1, ULXD2, ULXD4D and ULXD4Q only.'],
    ['G62', [[510, 530]]],
    ['G65', [[470, 606]], 'Wide-tuning: ULXD1, ULXD2, ULXD4D and ULXD4Q only.'],
    ['G66', [[487, 606]], 'Wide-tuning: ULXD1, ULXD2, ULXD4D and ULXD4Q only.'],
    ['H50', [[534, 598]]],
    ['H51', [[534, 598]]],
    ['H52', [[534, 565]]],
    ['H54', [[520, 636]], 'Wide-tuning: ULXD1, ULXD2, ULXD4D and ULXD4Q only.'],
    ['J50', [[572, 636]]],
    ['J50A', [[572, 608]], 'Output power limited to 10 mW above 608 MHz.'],
    ['J51', [[572, 636]]],
    ['K51', [[606, 670]], 'Romania restricts K51 to 646–647, 654–655 and 662–663 MHz.'],
    ['L50', [[632, 696]]],
    ['L51', [[632, 696]]],
    ['L52', [[632, 694]], 'Listed in the European country table but not the main band table.'],
    ['L53', [[632, 714]]],
    ['M19', [[694, 703]]],
    ['P51', [[710, 782]]],
    ['R51', [[800, 810]]],
    ['JB', [[806, 810]], 'Transmitter only.'],
    ['AB', [[770, 810]], 'A band 770–805 at 1/10/20 mW; B band 806–809 at 1/10 mW.'],
    ['Q12', [[748, 758]]],
    ['Q51', [[794, 806]]],
    ['V50', [[174, 216]], 'VHF. Use shielded Cat5e or better for networking.'],
    ['V51', [[174, 216]], 'VHF. Use shielded Cat5e or better for networking.'],
    ['V52', [[174, 210]], 'VHF.'],
    ['X50', [[925, 932]]],
    ['X51', [[925, 937.5]]],
    ['X52', [[902, 928]]],
    ['X53', [[902, 907.5], [915, 928]]],
    ['X54', [[915, 928]]],
    ['Z16', [[1240, 1260]]],
    ['Z17', [[1492, 1525]], 'Indoor use only.'],
    ['Z18', [[1785, 1805]]],
    ['Z19', [[1785, 1800]], 'In Australia must operate within 1790–1800 MHz when used outdoors.'],
    ['Z20', [[1790, 1805]]],
  ] as [string, number[][], string?][]
).map(([code, ranges, notes]) => ({
  code,
  ranges: ranges.map(([startMhz, endMhz]) => ({ startMhz: startMhz!, endMhz: endMhz! })),
  notes,
  provenance: guide('ULX-D', ULXD_GUIDE),
}));

// ---------------------------------------------------------------------------
// QLX-D
// ---------------------------------------------------------------------------

export const SHURE_QLXD_MODES: RfMode[] = [
  {
    id: 'standard',
    name: 'Standard',
    minSpacingKhz: 350,
    occupiedBandwidthKhz: 200,
    strategy: 'im-search',
    spacing: {
      basis: 'derived',
      source: `Shure QLX-D user guide — ${QLXD_GUIDE}`,
      retrieved: RETRIEVED,
      note:
        'Shure: "Up to 17 compatible systems per 6MHz TV band; 22 systems per 8 MHz band" ' +
        '→ 353 kHz / 364 kHz. QLX-D has no High Density mode.',
    },
    bandwidth: {
      basis: 'vendor-doc',
      source: `Shure QLX-D user guide — ${QLXD_GUIDE}`,
      retrieved: RETRIEVED,
      note: 'QLXD1/QLXD2 RF OUTPUT section: "Occupied Bandwidth <200 kHz".',
    },
  },
];

export const SHURE_QLXD_BANDS: BandVariant[] = (
  [
    ['G50', [[470, 534]]],
    ['G51', [[470, 534]]],
    ['G52', [[479, 534]]],
    ['G53', [[470, 510]]],
    ['G62', [[510, 530]]],
    ['H50', [[534, 598]]],
    ['H51', [[534, 598]]],
    ['H52', [[534, 565]]],
    ['H53', [[534, 598]]],
    ['J50', [[572, 636]]],
    ['J51', [[572, 636]]],
    ['JB', [[806, 810]]],
    ['K51', [[606, 670]], 'Romania restricts K51 to 646–647, 654–655 and 662–663 MHz.'],
    ['K52', [[606, 670]]],
    ['L50', [[632, 696]]],
    ['L51', [[632, 696]]],
    ['L52', [[632, 694]]],
    ['L53', [[632, 714]]],
    ['M19', [[694, 703]], 'Thailand.'],
    ['P51', [[710, 782]]],
    ['P52', [[710, 782]]],
    ['Q12', [[748, 758]], 'Thailand.'],
    ['Q51', [[794, 806]]],
    ['S50', [[823, 832], [863, 865]]],
    ['V50', [[174, 216]], 'VHF.'],
    ['V51', [[174, 216]], 'VHF.'],
    ['V52', [[174, 210]], 'VHF.'],
    ['X51', [[925, 937.5]]],
    ['X52', [[902, 928]], 'All Americas except Brazil.'],
    ['X53', [[902, 907.5], [915, 928]], 'Brazil.'],
    ['X54', [[915, 928]], 'Australia.'],
    ['Z17', [[1492, 1525]], 'Indoor use only.'],
    ['Z18', [[1785, 1805]]],
    ['Z19', [[1785, 1800]], 'In Australia must operate within 1790–1800 MHz when used outdoors.'],
    ['Z20', [[1790, 1805]]],
  ] as [string, number[][], string?][]
).map(([code, ranges, notes]) => ({
  code,
  ranges: ranges.map(([startMhz, endMhz]) => ({ startMhz: startMhz!, endMhz: endMhz! })),
  notes,
  provenance: guide('QLX-D', QLXD_GUIDE),
}));

// ---------------------------------------------------------------------------
// SLX-D
// ---------------------------------------------------------------------------

/**
 * SLX-D is the clearest case of the old flat placeholder being optimistic: the
 * catalog assumed 400 kHz, but Shure's own density figures put it at 600–667.
 */
export const SHURE_SLXD_MODES: RfMode[] = [
  {
    id: 'standard',
    name: 'Standard',
    minSpacingKhz: 667,
    occupiedBandwidthKhz: 200,
    strategy: 'im-search',
    spacing: {
      basis: 'derived',
      source: `Shure SLX-D user guide — ${SLXD_GUIDE}`,
      retrieved: RETRIEVED,
      note:
        'Shure: "Up to 10 compatible systems per 6MHz TV band; 12 systems per 8 MHz band" ' +
        '→ 600 kHz and 667 kHz. The wider figure is used so both of Shure\'s own claims hold.',
    },
    bandwidth: {
      basis: 'vendor-doc',
      source: `Shure SLX-D user guide — ${SLXD_GUIDE}`,
      retrieved: RETRIEVED,
      note: 'RF OUTPUT section: "Occupied Bandwidth <200 kHz".',
    },
    notes:
      'Shure also quotes "up to 32 compatible systems per 44 MHz band" (1375 kHz per channel) ' +
      'for a whole-band deployment.',
  },
];

export const SHURE_SLXD_BANDS: BandVariant[] = (
  [
    ['G58', [[470, 514]]],
    ['G59', [[470, 514]]],
    ['G60', [[470, 510]]],
    ['G61', [[479, 523]]],
    ['G62', [[510, 530]]],
    ['H55', [[514, 558]]],
    ['H56', [[518, 562]]],
    ['H57', [[520, 564]]],
    ['J52', [[558, 602], [614, 616]], '614–616 MHz segment is limited to 1/10 mW.'],
    ['J53', [[562, 606]]],
    ['J54', [[562, 606]]],
    ['JB', [[806, 810]], 'Tunes in 125 kHz steps, not 25 kHz.'],
    ['K59', [[606, 650]]],
    ['L55', [[646, 690]]],
    ['L56', [[650, 694]]],
    ['L57', [[650, 694]]],
    ['L58', [[630, 674]]],
    ['L59', [[654, 698]]],
    ['M55', [[694, 703], [748, 758]]],
    ['S50', [[823, 865]]],
    ['X51', [[925, 937.5]]],
  ] as [string, number[][], string?][]
).map(([code, ranges, notes]) => ({
  code,
  ranges: ranges.map(([startMhz, endMhz]) => ({ startMhz: startMhz!, endMhz: endMhz! })),
  // Shure: "RF Tuning Step Size — 25 kHz, varies by region. JB band: 125 kHz"
  tuningStepKhz: code === 'JB' ? 125 : undefined,
  notes,
  provenance: guide('SLX-D', SLXD_GUIDE),
}));

// ---------------------------------------------------------------------------
// PSM 1000
// ---------------------------------------------------------------------------

/**
 * PSM 1000 is analog FM MPX stereo, and it is the sharpest illustration of why
 * occupied bandwidth must not be used as a spacing proxy: it occupies roughly
 * 175 kHz but Shure's own compatible-frequency count implies ~1.85 MHz of
 * practical separation — more than ten times the footprint.
 */
export const SHURE_PSM1000_MODES: RfMode[] = [
  {
    id: 'standard',
    name: 'Standard',
    minSpacingKhz: 1846,
    occupiedBandwidthKhz: 174,
    strategy: 'im-search',
    spacing: {
      basis: 'derived',
      source: `Shure PSM 1000 user guide — ${PSM1000_GUIDE}`,
      retrieved: RETRIEVED,
      note:
        'Shure specifies "Compatible Frequencies — Per band: 39" over a "Tuning Bandwidth" of ' +
        '72–80 MHz → 1846 kHz (72 MHz) to 2051 kHz (80 MHz) per compatible channel. This is an ' +
        'average density across the band, not a vendor-stated minimum adjacent spacing.',
    },
    bandwidth: {
      basis: 'derived',
      source: `Shure PSM 1000 user guide — ${PSM1000_GUIDE}`,
      retrieved: RETRIEVED,
      note:
        "Carson's rule on the published FM MPX stereo figures: ±34 kHz deviation with a 53 kHz " +
        'MPX baseband → 2 × (34 + 53) = 174 kHz. Shure does not publish an occupied bandwidth.',
    },
  },
];

export const SHURE_PSM1000_BANDS: BandVariant[] = (
  [
    ['G10', [[470, 542]]],
    ['G10E', [[470, 542]]],
    ['G10J', [[470, 542]]],
    ['G11', [[479, 542]]],
    ['G62', [[510, 530]]],
    ['H8Z', [[518, 582]]],
    ['H22', [[518, 584]]],
    ['J8', [[554, 626]]],
    ['J8A', [[554, 608], [614, 616]], '614–616 MHz segment limited to 10 mW.'],
    ['J8E', [[554, 626]]],
    ['J8J', [[554, 626]]],
    ['K10E', [[596, 668]]],
    ['L8', [[626, 698]]],
    ['L8A', [[653, 663]], 'Shure lists 653–657 and 657–663 separately; 657–663 is limited to 10 mW.'],
    ['L8E', [[626, 698]]],
    ['L8J', [[626, 698]]],
    ['L9E', [[670, 742]]],
    ['L11J', [[670, 714]]],
    ['M19', [[694, 703]]],
    ['P8', [[710, 790]]],
    ['Q12', [[748, 758]]],
    ['Q21', [[710, 787]]],
    ['Q22E', [[750, 822]]],
    ['R27', [[794, 806]]],
    ['X1', [[944, 952]]],
    ['X7', [[925, 937.5]]],
    ['X55', [[941, 960]]],
  ] as [string, number[][], string?][]
).map(([code, ranges, notes]) => ({
  code,
  ranges: ranges.map(([startMhz, endMhz]) => ({ startMhz: startMhz!, endMhz: endMhz! })),
  notes,
  provenance: guide('PSM 1000', PSM1000_GUIDE),
}));
