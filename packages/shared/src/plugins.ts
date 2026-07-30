/**
 * Product plugins — the unit of device support in RFutils.
 *
 * One plugin describes ONE product (e.g. "Shure ULX-D", "Shure Axient Digital",
 * "Sennheiser EW-DX"): its coordination characteristics AND, optionally, how to
 * control it. Plugins are **declarative data** so users can create or update
 * their own without shipping code — drop a JSON file in ~/.rfutils/plugins/
 * (see PLUGINS.md). The server's shared transports (Shure command strings,
 * Sennheiser SSC, …) are generic engines that read a plugin's `control`
 * descriptor — command template + model match — to discover, monitor and
 * program that product.
 *
 * ⚠️ `verified` is false throughout: coordination numbers are conservative
 * starting points and control command templates are best-effort — check
 * against the product's datasheet / Command Strings PDF, or override in your
 * own plugin JSON.
 */

import type { FreqRange } from './coordination.js';
import type { BandVariant, RfMode } from './rf/types.js';
import { rfDataFor } from './rf/index.js';

export type PluginCategory = 'mic' | 'iem' | 'other';

/** A shared transport engine the server implements; plugins reference one. */
export type TransportId =
  | 'shure-command-strings'
  | 'sennheiser-ssc'
  | 'lectrosonics-net'
  | 'none';

export interface ProductControl {
  transport: TransportId;
  capabilities: { discover: boolean; monitor: boolean; program: boolean };
  /** Regex source matched against a discovered device's reported model to claim it. */
  matchModel?: string;
  /**
   * Program-command template for template-driven transports (e.g. Shure).
   * Placeholders: {ch} channel, {khz} integer kHz, {khz6} 6-digit kHz,
   * {mhz3} MHz to 3 dp.
   */
  programTemplate?: string;
}

export interface ProductPlugin {
  id: string;
  manufacturer: string;
  model: string;
  category: PluginCategory;
  // --- coordination ---
  /**
   * Default tuning raster, kHz. A {@link BandVariant} may override it — Shure
   * SLX-D tunes in 25 kHz steps everywhere except the JB band, which is 125 kHz.
   */
  tuningStepKhz: number;
  /**
   * RF footprint of one carrier, kHz. This is NOT the spacing to coordinate at
   * — see `recommendedSpacingMhz` and `modes`. A Shure PSM 1000 occupies
   * ~175 kHz but needs roughly 1.85 MHz between compatible channels.
   */
  occupiedBandwidthKhz: number;
  /**
   * Minimum carrier-to-carrier spacing, MHz — the figure coordination actually
   * uses. Derived from the default (first) entry in `modes` when the product has
   * been researched.
   */
  recommendedSpacingMhz: number;
  /** Suggested band preset id for the coordination form. */
  defaultBandPresetId?: string;
  /** Optional product-specific tuning ranges (rarely needed; bands cover most). */
  bands?: FreqRange[];
  /**
   * Frequency-range variants this product is sold in, with their real tunable
   * spectrum. Present only for products researched against vendor documentation.
   */
  bandVariants?: BandVariant[];
  /**
   * Operating modes, each with its own required spacing (standard vs high
   * density / link density). The first entry is the default.
   */
  modes?: RfMode[];
  // --- control (optional) ---
  control?: ProductControl;
  verified: boolean;
  notes?: string;
  /** Set by the server when a plugin comes from the user's plugins dir. */
  source?: 'builtin' | 'user';
}

/** Fill a program-command template for a channel + frequency. */
export function renderProgramCommand(
  template: string,
  channel: string | number,
  frequencyMhz: number
): string {
  const khz = Math.round(frequencyMhz * 1000);
  return template
    .split('{ch}').join(String(channel))
    .split('{khz6}').join(String(khz).padStart(6, '0'))
    .split('{khz}').join(String(khz))
    .split('{mhz3}').join(frequencyMhz.toFixed(3));
}

const SHURE_CMD = (template: string, matchModel: string): ProductControl => ({
  transport: 'shure-command-strings',
  capabilities: { discover: true, monitor: true, program: true },
  matchModel,
  programTemplate: template,
});

const SSC_MONITOR: ProductControl = {
  transport: 'sennheiser-ssc',
  capabilities: { discover: true, monitor: true, program: false },
};

/**
 * Lectrosonics networked receivers (DSQD / Duet). The adapter exists but its
 * wire format is an unverified placeholder — see the server's
 * lectrosonicsProtocol.ts. `program` is enabled (dry-run-safe by default).
 */
const LECTRO_CONTROL = (matchModel: string): ProductControl => ({
  transport: 'lectrosonics-net',
  capabilities: { discover: true, monitor: true, program: true },
  matchModel,
  programTemplate: 'SET {ch} FREQ {khz}',
});

/**
 * The declarative catalog. Coordination numbers here are the *fallback* — for
 * any product with an entry in the sourced-RF registry, `applyRfData` below
 * replaces them with the vendor-documented figures.
 */
const RAW_PLUGINS: ProductPlugin[] = [
  // --- Shure (command strings: discover / monitor / program) ---------------
  { id: 'shure-axient-digital', manufacturer: 'Shure', model: 'Axient Digital (AD/ADX)', category: 'mic', tuningStepKhz: 25, occupiedBandwidthKhz: 200, recommendedSpacingMhz: 0.35, defaultBandPresetId: 'uk-uhf-core', control: SHURE_CMD('< SET {ch} CHAN_FREQ {khz6} >', '^AD|Axient'), verified: false, notes: 'Very wide tuning; set your unit\'s actual band. Command keyword unverified.' },
  { id: 'shure-ulxd', manufacturer: 'Shure', model: 'ULX-D', category: 'mic', tuningStepKhz: 25, occupiedBandwidthKhz: 200, recommendedSpacingMhz: 0.35, defaultBandPresetId: 'uk-uhf-core', control: SHURE_CMD('< SET {ch} FREQUENCY {khz6} >', 'ULXD?'), verified: false },
  { id: 'shure-qlxd', manufacturer: 'Shure', model: 'QLX-D', category: 'mic', tuningStepKhz: 25, occupiedBandwidthKhz: 200, recommendedSpacingMhz: 0.35, defaultBandPresetId: 'uk-uhf-core', control: SHURE_CMD('< SET {ch} FREQUENCY {khz6} >', 'QLXD?'), verified: false },
  { id: 'shure-slxd', manufacturer: 'Shure', model: 'SLX-D', category: 'mic', tuningStepKhz: 25, occupiedBandwidthKhz: 200, recommendedSpacingMhz: 0.4, defaultBandPresetId: 'uk-uhf-core', control: SHURE_CMD('< SET {ch} FREQUENCY {khz6} >', 'SLXD?'), verified: false, notes: 'Networked control on Ethernet variants.' },
  { id: 'shure-psm1000', manufacturer: 'Shure', model: 'PSM 1000 (IEM)', category: 'iem', tuningStepKhz: 25, occupiedBandwidthKhz: 200, recommendedSpacingMhz: 0.4, defaultBandPresetId: 'uk-uhf-core', control: SHURE_CMD('< SET {ch} FREQUENCY {khz6} >', 'P10T|PSM'), verified: false },
  { id: 'shure-glxd', manufacturer: 'Shure', model: 'GLX-D', category: 'mic', tuningStepKhz: 25, occupiedBandwidthKhz: 200, recommendedSpacingMhz: 0.4, defaultBandPresetId: 'ism-2g4', verified: false, notes: '2.4 GHz, self-coordinating; not UHF.' },

  // --- Sennheiser (SSC: discover / monitor) --------------------------------
  { id: 'sennheiser-ewdx', manufacturer: 'Sennheiser', model: 'EW-DX', category: 'mic', tuningStepKhz: 25, occupiedBandwidthKhz: 200, recommendedSpacingMhz: 0.35, defaultBandPresetId: 'uk-uhf-core', control: SSC_MONITOR, verified: false },
  { id: 'sennheiser-ewd', manufacturer: 'Sennheiser', model: 'EW-D', category: 'mic', tuningStepKhz: 25, occupiedBandwidthKhz: 200, recommendedSpacingMhz: 0.6, defaultBandPresetId: 'uk-uhf-core', control: SSC_MONITOR, verified: false, notes: 'Equidistant tuning; wider default spacing.' },
  { id: 'sennheiser-d6000', manufacturer: 'Sennheiser', model: 'Digital 6000', category: 'mic', tuningStepKhz: 25, occupiedBandwidthKhz: 200, recommendedSpacingMhz: 0.4, defaultBandPresetId: 'uk-uhf-core', control: SSC_MONITOR, verified: false },
  { id: 'sennheiser-d9000', manufacturer: 'Sennheiser', model: 'Digital 9000', category: 'mic', tuningStepKhz: 25, occupiedBandwidthKhz: 200, recommendedSpacingMhz: 0.4, defaultBandPresetId: 'uk-uhf-core', control: SSC_MONITOR, verified: false, notes: 'HD mode can pack tighter; verify per mode.' },
  { id: 'sennheiser-ew-g4', manufacturer: 'Sennheiser', model: 'evolution wireless G4', category: 'mic', tuningStepKhz: 25, occupiedBandwidthKhz: 200, recommendedSpacingMhz: 0.4, defaultBandPresetId: 'uk-uhf-core', verified: false, notes: 'Analog FM, IR-sync only — no networked control; file export.' },
  { id: 'sennheiser-2000', manufacturer: 'Sennheiser', model: '2000 series', category: 'mic', tuningStepKhz: 25, occupiedBandwidthKhz: 200, recommendedSpacingMhz: 0.4, defaultBandPresetId: 'uk-uhf-core', verified: false },
  { id: 'sennheiser-iem-g4', manufacturer: 'Sennheiser', model: 'IEM G4 (SR)', category: 'iem', tuningStepKhz: 25, occupiedBandwidthKhz: 200, recommendedSpacingMhz: 0.4, defaultBandPresetId: 'uk-uhf-core', verified: false },

  // --- Other makers: coordination + export; control stubs where a protocol exists ---
  { id: 'lectrosonics-dsqd', manufacturer: 'Lectrosonics', model: 'DSQD / D Squared', category: 'mic', tuningStepKhz: 25, occupiedBandwidthKhz: 200, recommendedSpacingMhz: 0.35, defaultBandPresetId: 'uk-uhf-core', control: LECTRO_CONTROL('DSQD|DSR|Duet|DCR'), verified: false, notes: 'Ethernet control port (Wireless Designer + third-party). Adapter wired, but wire format is an unverified placeholder — see server lectrosonicsProtocol.ts; dry-run and verify before sending. Dante-capable.' },
  { id: 'wisycom-mcr54', manufacturer: 'Wisycom', model: 'MCR54 / MTP (wideband)', category: 'mic', tuningStepKhz: 25, occupiedBandwidthKhz: 200, recommendedSpacingMhz: 0.35, defaultBandPresetId: 'uk-uhf-core', verified: false, notes: 'Ethernet "Wisycom Remote Protocol" (Wisycom Manager); Dante on some. Proprietary — cue Dante audio via capture mode.' },
  { id: 'sounddevices-a20', manufacturer: 'Sound Devices', model: 'A20 (Astral / A20-Nexus)', category: 'mic', tuningStepKhz: 25, occupiedBandwidthKhz: 200, recommendedSpacingMhz: 0.35, defaultBandPresetId: 'uk-uhf-core', verified: false, notes: 'IP web-app control + NexLink + Dante. Proprietary web API; cue Dante audio via capture mode.' },
  { id: 'audioltd-a10', manufacturer: 'Audio Ltd (Sound Devices)', model: 'A10', category: 'mic', tuningStepKhz: 25, occupiedBandwidthKhz: 200, recommendedSpacingMhz: 0.35, defaultBandPresetId: 'uk-uhf-core', verified: false, notes: 'Audio Limited A10, now Sound Devices. Coordinate + export.' },
  { id: 'sony-dwx', manufacturer: 'Sony', model: 'DWX (DWR-R03D)', category: 'mic', tuningStepKhz: 25, occupiedBandwidthKhz: 200, recommendedSpacingMhz: 0.35, defaultBandPresetId: 'uk-uhf-core', verified: false, notes: 'Wireless Studio (PC) + Dante. Proprietary; cue Dante audio via capture mode.' },
  { id: 'mipro-act', manufacturer: 'MiPro', model: 'ACT series', category: 'mic', tuningStepKhz: 25, occupiedBandwidthKhz: 200, recommendedSpacingMhz: 0.4, defaultBandPresetId: 'uk-uhf-core', verified: false, notes: 'RCS2.Net over proprietary ACT-BUS; Dante on some ACT-7x. Coordinate + export.' },
  { id: 'dpa-nseries', manufacturer: 'DPA', model: 'N-Series (N-DR1)', category: 'mic', tuningStepKhz: 25, occupiedBandwidthKhz: 200, recommendedSpacingMhz: 0.35, defaultBandPresetId: 'uk-uhf-core', bands: [{ startMhz: 470, endMhz: 870 }], verified: false, notes: '470–870 MHz. DPA Audio Controller (PC/Mac) for control/monitoring + frequency management. Proprietary; coordinate + export.' },
  { id: 'deity-theos', manufacturer: 'Deity', model: 'Theos', category: 'mic', tuningStepKhz: 25, occupiedBandwidthKhz: 200, recommendedSpacingMhz: 0.4, defaultBandPresetId: 'uk-uhf-core', bands: [{ startMhz: 550, endMhz: 663 }], verified: false, notes: '550–663 MHz (region-dependent). Control + its own coordination via the Sidus Audio phone app (app/Bluetooth) — not an open network; coordinate + export.' },
  { id: 'audiotechnica-5000', manufacturer: 'Audio-Technica', model: '5000 series', category: 'mic', tuningStepKhz: 25, occupiedBandwidthKhz: 200, recommendedSpacingMhz: 0.4, defaultBandPresetId: 'uk-uhf-core', verified: false },
];

/**
 * Overlay the researched RF data onto a raw catalog entry.
 *
 * The product's headline numbers become the ones its **default mode** actually
 * requires, so nothing downstream has to know about modes to get a correct
 * answer — but `modes` and `bandVariants` are there for anything that does.
 *
 * `verified` is set only when the default mode's spacing figure is quoted from
 * vendor documentation. A derived or assumed figure leaves it false, which is
 * what the README's "verify before a live show" warning depends on.
 */
function applyRfData(p: ProductPlugin): ProductPlugin {
  const rf = rfDataFor(p.id);
  if (!rf) return p;
  const primary = rf.modes[0];
  return {
    ...p,
    tuningStepKhz: rf.tuningStepKhz,
    occupiedBandwidthKhz: primary?.occupiedBandwidthKhz ?? p.occupiedBandwidthKhz,
    recommendedSpacingMhz: primary ? primary.minSpacingKhz / 1000 : p.recommendedSpacingMhz,
    bandVariants: rf.bandVariants.length ? rf.bandVariants : undefined,
    modes: rf.modes,
    verified: primary?.spacing.basis === 'vendor-doc',
  };
}

/** The built-in product catalog, with vendor-sourced RF data merged in. */
export const BUILTIN_PLUGINS: ProductPlugin[] = RAW_PLUGINS.map(applyRfData);
