/**
 * Persists the system inventory as JSON in the config dir
 * (RFUTILS_CONFIG_DIR, default ~/.rfutils/inventory.json) — the same dir the
 * Companion config lives in. Single-user, so plain read/write is fine.
 */

import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import type { Inventory, InventoryItem } from '@rfutils/shared';
import { emptyInventory } from '@rfutils/shared';
import { say } from '../diag/index.js';

function configDir(): string {
  return process.env.RFUTILS_CONFIG_DIR ?? path.join(os.homedir(), '.rfutils');
}

function inventoryPath(): string {
  return path.join(configDir(), 'inventory.json');
}

export function loadInventory(): Inventory {
  const file = inventoryPath();
  if (!fs.existsSync(file)) return emptyInventory();
  try {
    const raw = JSON.parse(fs.readFileSync(file, 'utf8')) as Inventory;
    if (!raw || !Array.isArray(raw.items)) return emptyInventory();
    return raw;
  } catch (err) {
    say.error(`[inventory] failed to parse ${file}:`, (err as Error).message);
    return emptyInventory();
  }
}

export function saveInventory(items: InventoryItem[]): Inventory {
  const inv: Inventory = { items, updatedAt: new Date().toISOString() };
  const dir = configDir();
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(inventoryPath(), JSON.stringify(inv, null, 2), 'utf8');
  return inv;
}
