/**
 * Serves the equipment-profile / band-preset catalog: the built-in list from
 * @rfutils/shared merged with an optional user file at
 * RFUTILS_CONFIG_DIR/profiles.json (default ~/.rfutils/profiles.json). User
 * entries with the same id override built-ins, so a show can add its exact
 * band variants without touching the code.
 */

import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import type { ProfileCatalog } from '@rfutils/shared';
import { builtinCatalog } from '@rfutils/shared';

function configDir(): string {
  return process.env.RFUTILS_CONFIG_DIR ?? path.join(os.homedir(), '.rfutils');
}

function mergeById<T extends { id: string }>(base: T[], extra: T[]): T[] {
  const byId = new Map(base.map((x) => [x.id, x]));
  for (const item of extra) if (item && typeof item.id === 'string') byId.set(item.id, item);
  return [...byId.values()];
}

export function loadCatalog(): ProfileCatalog {
  const builtin = builtinCatalog();
  const file = path.join(configDir(), 'profiles.json');
  if (!fs.existsSync(file)) return builtin;
  try {
    const user = JSON.parse(fs.readFileSync(file, 'utf8')) as Partial<ProfileCatalog>;
    return {
      profiles: mergeById(builtin.profiles, (user.profiles ?? [])),
      bandPresets: mergeById(builtin.bandPresets, (user.bandPresets ?? [])),
    };
  } catch (err) {
    console.error(`[profiles] failed to parse ${file}:`, (err as Error).message);
    return builtin;
  }
}
