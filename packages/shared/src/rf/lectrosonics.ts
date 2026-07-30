/**
 * Lectrosonics band variants and RF modes.
 *
 * Lectrosonics does not name bands per product the way Shure and Sennheiser do.
 * Its spectrum is divided into **25.6 MHz "blocks"**, and a receiver's band is a
 * named set of adjacent blocks. The block width is confirmed in Lectrosonics'
 * own words: "256 pilot tone frequencies are used across each 25.6 MHz block
 * within the tuning range of the system."
 *
 * The RF link is an analog FM carrier — Digital Hybrid Wireless encodes 24-bit
 * digital audio *into* an analog FM link (US Patent 7,225,135) rather than
 * transmitting a digital carrier — so its spectral footprint behaves like
 * analog FM, not like Shure/Sennheiser digital.
 *
 * Sourced from the SRc5P/SRc Technical Data sheet (13 November 2018) and the
 * DSQD product page, read 2026-07-30.
 */

import type { BandVariant, Provenance, RfMode } from './types.js';

const RETRIEVED = '2026-07-30';

const SRC_TD = 'https://lectrosonics.com/wp-content/uploads/filr/3380/SRc5P_SRc_td.pdf';
const DSQD_PAGE = 'https://lectrosonics.com/product/dsqd/';

const srcDoc: Provenance = {
  basis: 'vendor-doc',
  source: `Lectrosonics SRc5P & SRc Technical Data (13 Nov 2018) — ${SRC_TD}`,
  retrieved: RETRIEVED,
};

/**
 * The named bands from the SRc data sheet's "Three Block Tuning Range" table.
 * These are the block groupings Lectrosonics actually sells; DSQD covers the
 * A1/B1 span (470.100 – 614.375 MHz) plus narrowband Block 606.
 */
export const LECTRO_BANDS: BandVariant[] = [
  {
    code: 'A1',
    ranges: [{ startMhz: 470.1, endMhz: 537.575 }],
    notes: 'Blocks 470, 19, 20.',
    provenance: srcDoc,
  },
  {
    code: 'B1',
    ranges: [{ startMhz: 537.6, endMhz: 614.375 }],
    notes: 'Blocks 21, 22, 23.',
    provenance: srcDoc,
  },
  {
    code: 'B2',
    ranges: [{ startMhz: 563.2, endMhz: 639.975 }],
    notes: 'Blocks 22, 23, 24.',
    provenance: srcDoc,
  },
  {
    code: 'Block 606',
    ranges: [{ startMhz: 606, endMhz: 631.5 }],
    notes: 'Blocks 23, 24. Narrowband; DSQD gained support in firmware v16Sep2019.',
    provenance: srcDoc,
  },
  {
    code: 'C1',
    ranges: [{ startMhz: 614.4, endMhz: 691.175 }],
    notes: 'Blocks 24, 25, 26.',
    provenance: srcDoc,
  },
  {
    code: 'C2',
    ranges: [{ startMhz: 640, endMhz: 716.775 }],
    notes: 'Blocks 25, 26, 27. The Specifications page gives this as 640.000–713.900 / 716.775 MHz selectable.',
    provenance: srcDoc,
  },
];

/**
 * Lectrosonics publishes neither an occupied bandwidth nor a minimum channel
 * spacing for these products. "Modulation acceptance: 85 kHz" is the receiver's
 * FM deviation acceptance and is NOT an occupied-bandwidth figure — do not
 * substitute it. The spacing below is therefore explicitly assumed.
 */
export const LECTRO_MODES: RfMode[] = [
  {
    id: 'standard',
    name: 'Standard',
    minSpacingKhz: 350,
    strategy: 'im-search',
    spacing: {
      basis: 'assumed',
      source: `Lectrosonics SRc technical data — ${SRC_TD}`,
      retrieved: RETRIEVED,
      note:
        'Lectrosonics publishes no minimum channel spacing. 350 kHz is carried over as a ' +
        'conservative working figure. What IS published: adjacent channel isolation > 85 dB ' +
        '(DSQD), image and spurious rejection 85 dB, third order intercept 0 dBm. VERIFY ' +
        'against a Wireless Designer coordination before relying on this.',
    },
    notes:
      'Tuning step is selectable 25 kHz or 100 kHz; per the DSQD page the 100 kHz option is ' +
      'for legacy Digital Hybrid transmitters.',
  },
];

/** DSQD's own tunable span, narrower than the full SRc band set. */
export const LECTRO_DSQD_RANGE = { startMhz: 470.1, endMhz: 614.375 };

export const LECTRO_DSQD_PROVENANCE: Provenance = {
  basis: 'vendor-doc',
  source: `Lectrosonics DSQD product page — ${DSQD_PAGE}`,
  retrieved: RETRIEVED,
  note: '"Continuously tunable tracking filters covering 470.100 – 614.375 MHz".',
};
