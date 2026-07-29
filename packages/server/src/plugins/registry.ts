/**
 * Product-plugin registry: the built-in catalog merged with the user's own
 * plugins. Users drop one JSON file per product into RFUTILS_CONFIG_DIR/plugins/
 * (default ~/.rfutils/plugins/) — each file a ProductPlugin object (or an array
 * of them). A user plugin with the same `id` overrides the built-in, so shows
 * can add new products or correct command templates / tuning without code.
 * See PLUGINS.md.
 */

import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import type { ProductPlugin } from '@rfutils/shared';
import { BUILTIN_PLUGINS } from '@rfutils/shared';
import { say } from '../diag/index.js';

function configDir(): string {
  return process.env.RFUTILS_CONFIG_DIR ?? path.join(os.homedir(), '.rfutils');
}

function pluginsDir(): string {
  return path.join(configDir(), 'plugins');
}

const VALID_TRANSPORTS = new Set(['shure-command-strings', 'sennheiser-ssc', 'lectrosonics-net', 'none']);

/** Minimal structural validation so a malformed user file can't crash the app. */
function isValidPlugin(x: unknown): x is ProductPlugin {
  if (!x || typeof x !== 'object') return false;
  const p = x as Record<string, unknown>;
  if (typeof p.id !== 'string' || !p.id) return false;
  if (typeof p.manufacturer !== 'string' || typeof p.model !== 'string') return false;
  if (p.category !== 'mic' && p.category !== 'iem' && p.category !== 'other') return false;
  if (typeof p.tuningStepKhz !== 'number' || typeof p.recommendedSpacingMhz !== 'number') return false;
  if (p.control !== undefined) {
    const c = p.control as Record<string, unknown>;
    if (!c || typeof c !== 'object' || !VALID_TRANSPORTS.has(c.transport as string)) return false;
  }
  return true;
}

function loadUserPlugins(): ProductPlugin[] {
  const dir = pluginsDir();
  if (!fs.existsSync(dir)) return [];
  const out: ProductPlugin[] = [];
  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith('.json')) continue;
    const full = path.join(dir, file);
    try {
      const parsed: unknown = JSON.parse(fs.readFileSync(full, 'utf8'));
      const items = Array.isArray(parsed) ? parsed : [parsed];
      for (const item of items) {
        if (isValidPlugin(item)) {
          out.push({ ...item, source: 'user' });
        } else {
          say.error(`[plugins] ${file}: skipped an entry that isn't a valid ProductPlugin`);
        }
      }
    } catch (err) {
      say.error(`[plugins] failed to parse ${full}:`, (err as Error).message);
    }
  }
  return out;
}

/** Built-ins (tagged 'builtin') merged with user plugins (user id overrides). */
export function loadPlugins(): ProductPlugin[] {
  const byId = new Map<string, ProductPlugin>();
  for (const p of BUILTIN_PLUGINS) byId.set(p.id, { ...p, source: 'builtin' });
  for (const p of loadUserPlugins()) byId.set(p.id, p);
  return [...byId.values()];
}

export function findPlugin(id: string | undefined): ProductPlugin | undefined {
  if (!id) return undefined;
  return loadPlugins().find((p) => p.id === id);
}

/**
 * Best-effort match of a discovered device's reported model string to a
 * programmable plugin (any transport), via each plugin's `control.matchModel`
 * regex. Lets the deployment path pick the right per-product command template
 * automatically, without the client having to know the product.
 */
export function findPluginForModel(
  model: string | null | undefined,
  plugins: ProductPlugin[] = loadPlugins()
): ProductPlugin | undefined {
  if (!model) return undefined;
  for (const p of plugins) {
    const c = p.control;
    if (!c?.matchModel || !c.capabilities.program) continue;
    try {
      if (new RegExp(c.matchModel, 'i').test(model)) return p;
    } catch {
      // ignore a malformed user regex rather than crash programming
    }
  }
  return undefined;
}
