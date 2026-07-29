/**
 * Coordination-facing catalog: equipment profiles derived from the product-
 * plugin registry (built-in + user plugins), plus band presets. Band presets
 * (regional operating ranges, not per-product) can still be extended via
 * RFUTILS_CONFIG_DIR/profiles.json { "bandPresets": [...] }.
 */

import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import type { ProfileCatalog, BandPreset } from '@rfutils/shared';
import { BAND_PRESETS, pluginToProfile } from '@rfutils/shared';
import { loadPlugins } from '../plugins/registry.js';
import { say } from '../diag/index.js';

function configDir(): string {
  return process.env.RFUTILS_CONFIG_DIR ?? path.join(os.homedir(), '.rfutils');
}

function loadUserBandPresets(): BandPreset[] {
  const file = path.join(configDir(), 'profiles.json');
  if (!fs.existsSync(file)) return [];
  try {
    const raw = JSON.parse(fs.readFileSync(file, 'utf8')) as { bandPresets?: BandPreset[] };
    return Array.isArray(raw.bandPresets) ? raw.bandPresets : [];
  } catch (err) {
    say.error(`[profiles] failed to parse ${file}:`, (err as Error).message);
    return [];
  }
}

export function loadCatalog(): ProfileCatalog {
  const byId = new Map<string, BandPreset>();
  for (const b of BAND_PRESETS) byId.set(b.id, b);
  for (const b of loadUserBandPresets()) if (b && typeof b.id === 'string') byId.set(b.id, b);
  return {
    profiles: loadPlugins().map(pluginToProfile),
    bandPresets: [...byId.values()],
  };
}
