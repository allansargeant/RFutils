/**
 * Equipment profiles + band presets for coordination.
 *
 * A profile captures the coordination-relevant characteristics of a product:
 * which control protocol RFutils can talk to it with, the tuning raster, the
 * occupied bandwidth, and a sensible recommended carrier spacing. Tuning
 * *ranges* are deliberately NOT baked into product profiles — the usable range
 * is region- and band-variant-specific — so ranges come from separate, clearly
 * region-tagged band presets instead.
 *
 * ⚠️ These are STARTING POINTS, not a substitute for the datasheet. Occupied
 * bandwidth and recommended spacing vary by mode/region; band-preset ranges
 * depend on your licence and local spectrum. `verified` is false throughout —
 * check against your actual unit and licence before a live show. The catalog
 * is user-extensible: drop a profiles.json in RFUTILS_CONFIG_DIR to add or
 * override entries.
 */

import { BUILTIN_PLUGINS, type ProductPlugin, type TransportId } from './plugins.js';

/** Control protocol RFutils can use to talk to (and program) a device. */
export type DeviceProtocol =
  | 'shure-command-strings' // Shure TCP :2202 — discover, monitor, program
  | 'sennheiser-ssc' // Sennheiser SSC — discover, monitor
  | 'aes67' // Dante/AES67 audio (no RF control)
  | 'analog' // IR-sync / no networked control — file export only
  | 'other';

export type EquipmentCategory = 'mic' | 'iem' | 'other';

export interface EquipmentProfile {
  id: string;
  manufacturer: string;
  model: string;
  category: EquipmentCategory;
  protocol: DeviceProtocol;
  /** Tuning raster in kHz (25 kHz for essentially all modern UHF wireless). */
  tuningStepKhz: number;
  /** Typical occupied RF bandwidth per carrier, kHz. */
  occupiedBandwidthKhz: number;
  /** Recommended minimum carrier-to-carrier spacing, MHz. */
  recommendedSpacingMhz: number;
  /** Default band preset id to pair with (a sensible starting range). */
  defaultBandPresetId?: string;
  /** Not datasheet-verified — always false here; see module note. */
  verified: boolean;
  notes?: string;
}

export interface BandPreset {
  id: string;
  name: string;
  /** Regulatory region this preset's ranges assume. */
  region: 'UK' | 'EU' | 'US' | 'Global';
  ranges: { startMhz: number; endMhz: number }[];
  notes?: string;
}

/**
 * Regional operating bands (the "where can I tune" ranges). Licence-dependent —
 * verify against your PMSE/FCC authorisation. UHF cores are given as broad
 * spans; narrow them to your cleared DTT gaps in the Coordination form.
 */
export const BAND_PRESETS: BandPreset[] = [
  {
    id: 'uk-ch38',
    name: 'UK Ch38 (shared)',
    region: 'UK',
    ranges: [{ startMhz: 606.5, endMhz: 614 }],
    notes: 'UK shared PMSE coordination band (TV channel 38).',
  },
  {
    id: 'uk-uhf-core',
    name: 'UK UHF PMSE (470–608)',
    region: 'UK',
    ranges: [{ startMhz: 470, endMhz: 608 }],
    notes: 'Licensed UHF PMSE core. Exclude occupied local DTT muxes for your area.',
  },
  {
    id: 'uk-ch70',
    name: 'UK/EU Ch70 (863–865, licence-exempt)',
    region: 'EU',
    ranges: [{ startMhz: 863, endMhz: 865 }],
    notes: 'Deregulated 863–865 MHz — ~4 usable channels, no licence.',
  },
  {
    id: 'us-uhf-core',
    name: 'US UHF (470–608)',
    region: 'US',
    ranges: [{ startMhz: 470, endMhz: 608 }],
    notes: 'Post-repack US UHF. Avoid the 600 MHz duplex gap/guard per FCC rules.',
  },
  {
    id: 'ism-2g4',
    name: '2.4 GHz ISM (2400–2483.5)',
    region: 'Global',
    ranges: [{ startMhz: 2400, endMhz: 2483.5 }],
    notes: 'Licence-exempt 2.4 GHz (e.g. Shure GLX-D). Usually auto-coordinated by the system.',
  },
];

/** Map a product plugin's transport to the coarse DeviceProtocol the UI shows. */
function transportToProtocol(t: TransportId | undefined): DeviceProtocol {
  switch (t) {
    case 'shure-command-strings':
      return 'shure-command-strings';
    case 'sennheiser-ssc':
      return 'sennheiser-ssc';
    default:
      return 'other';
  }
}

/** A coordination-facing view of a product plugin (backward-compatible shape). */
export function pluginToProfile(p: ProductPlugin): EquipmentProfile {
  return {
    id: p.id,
    manufacturer: p.manufacturer,
    model: p.model,
    category: p.category,
    protocol: transportToProtocol(p.control?.transport),
    tuningStepKhz: p.tuningStepKhz,
    occupiedBandwidthKhz: p.occupiedBandwidthKhz,
    recommendedSpacingMhz: p.recommendedSpacingMhz,
    defaultBandPresetId: p.defaultBandPresetId,
    verified: p.verified,
    notes: p.notes,
  };
}

/** The built-in equipment profiles, derived from the product-plugin catalog. */
export const EQUIPMENT_PROFILES: EquipmentProfile[] = BUILTIN_PLUGINS.map(pluginToProfile);

export interface ProfileCatalog {
  profiles: EquipmentProfile[];
  bandPresets: BandPreset[];
}

export function builtinCatalog(): ProfileCatalog {
  return { profiles: EQUIPMENT_PROFILES, bandPresets: BAND_PRESETS };
}

export interface DerivedCoordDefaults {
  /** Most conservative recommended spacing across the gear (so all are happy). */
  minSpacingMhz: number;
  /** Finest tuning raster across the gear. */
  stepMhz: number;
  /** Most common suggested band preset among the gear, if any. */
  bandPresetId?: string;
}

/**
 * Derive coordination defaults from a mix of equipment profiles: the widest
 * recommended spacing, the finest step, and the most common suggested band.
 * Falls back to safe generic defaults when nothing matches.
 */
export function deriveCoordDefaults(
  profileIds: (string | undefined)[],
  catalog: ProfileCatalog
): DerivedCoordDefaults {
  const profiles = profileIds
    .map((id) => (id ? catalog.profiles.find((p) => p.id === id) : undefined))
    .filter((p): p is EquipmentProfile => !!p);
  if (profiles.length === 0) return { minSpacingMhz: 0.4, stepMhz: 0.025 };

  const minSpacingMhz = Math.max(...profiles.map((p) => p.recommendedSpacingMhz));
  const stepMhz = Math.min(...profiles.map((p) => p.tuningStepKhz)) / 1000;

  const counts = new Map<string, number>();
  for (const p of profiles) {
    if (p.defaultBandPresetId) counts.set(p.defaultBandPresetId, (counts.get(p.defaultBandPresetId) ?? 0) + 1);
  }
  let bandPresetId: string | undefined;
  let best = 0;
  for (const [id, c] of counts) {
    if (c > best) {
      best = c;
      bandPresetId = id;
    }
  }
  return { minSpacingMhz, stepMhz, bandPresetId };
}
