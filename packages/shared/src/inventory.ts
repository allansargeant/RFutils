/**
 * System inventory — the user's wireless equipment, offline or live.
 *
 * An offline inventory is built by hand (what gear you own / are bringing to a
 * show) and drives how many frequencies coordination must place and how they
 * get allocated. Live-discovered devices (from the Monitor tab) can be
 * imported into it, so the same list spans planned and present equipment.
 */

export type InventoryRole = 'mic' | 'iem' | 'other';

export interface InventoryItem {
  id: string;
  /** Human label / talent / role, e.g. "Lead Vocal", "Presenter IEM". */
  label: string;
  vendor: string;
  model: string;
  /** Band or tuning range label, e.g. "G56" or "470-534". */
  band: string;
  role: InventoryRole;
  /** Number of RF channels this item needs coordinated (default 1). */
  quantity: number;
  /** Include in coordination/allocation counts. */
  coordinate: boolean;
  /** Where it came from. */
  source: 'manual' | 'discovered';
  /** Links to a live DiscoveredDevice id when source === 'discovered'. */
  deviceId?: string;
  notes?: string;
}

export interface Inventory {
  items: InventoryItem[];
  /** ISO timestamp of the last save, set by the server. */
  updatedAt?: string;
}

export function emptyInventory(): Inventory {
  return { items: [] };
}

/** Total RF channels needing coordination across the inventory. */
export function channelsNeeded(inv: Inventory): number {
  return inv.items
    .filter((i) => i.coordinate)
    .reduce((sum, i) => sum + Math.max(0, Math.floor(i.quantity) || 0), 0);
}

/** Expand items into one name per needed channel (for coordination naming). */
export function channelNames(inv: Inventory): string[] {
  const names: string[] = [];
  for (const item of inv.items) {
    if (!item.coordinate) continue;
    const q = Math.max(0, Math.floor(item.quantity) || 0);
    for (let i = 0; i < q; i++) {
      names.push(q > 1 ? `${item.label} ${i + 1}` : item.label);
    }
  }
  return names;
}
