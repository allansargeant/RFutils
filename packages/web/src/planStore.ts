import { create } from 'zustand';
import type { CoordinationResult, InventoryItem, DiscoveredDevice } from '@rfutils/shared';
import { getInventory, putInventory, getDevices } from './api.js';

/**
 * Shared state for the plan pipeline: inventory (persisted server-side) →
 * coordination result → allocations. Inventory / Coordination / Allocation /
 * Deployment tabs all read and write this one store.
 */

export interface Allocation {
  frequencyMhz: number;
  name: string;
  /** Inventory item this frequency is allocated to, if any. */
  itemId?: string;
  locked?: boolean;
}

interface PlanState {
  items: InventoryItem[];
  loaded: boolean;
  saving: boolean;
  coordination: CoordinationResult | null;
  allocations: Allocation[];

  load: () => Promise<void>;
  replaceItems: (items: InventoryItem[]) => void;
  addItem: (partial?: Partial<InventoryItem>) => void;
  updateItem: (id: string, patch: Partial<InventoryItem>) => void;
  removeItem: (id: string) => void;
  importFromLive: () => Promise<number>;
  setCoordination: (r: CoordinationResult | null) => void;
  setAllocations: (a: Allocation[]) => void;
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;

function newId(): string {
  // Not crypto — just a local unique id for list rows.
  return 'inv-' + Math.abs(Date.now() ^ Math.floor(Math.random() * 1e9)).toString(36);
}

export const usePlanStore = create<PlanState>((set, get) => {
  const scheduleSave = (): void => {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      set({ saving: true });
      putInventory(get().items)
        .catch(() => {})
        .finally(() => set({ saving: false }));
    }, 600);
  };

  return {
    items: [],
    loaded: false,
    saving: false,
    coordination: null,
    allocations: [],

    load: async () => {
      try {
        const inv = await getInventory();
        set({ items: inv.items, loaded: true });
      } catch {
        set({ loaded: true });
      }
    },

    replaceItems: (items) => {
      set({ items });
      scheduleSave();
    },

    addItem: (partial) => {
      const item: InventoryItem = {
        id: newId(),
        label: 'New channel',
        vendor: '',
        model: '',
        band: '',
        role: 'mic',
        quantity: 1,
        coordinate: true,
        source: 'manual',
        ...partial,
      };
      set({ items: [...get().items, item] });
      scheduleSave();
    },

    updateItem: (id, patch) => {
      set({ items: get().items.map((i) => (i.id === id ? { ...i, ...patch } : i)) });
      scheduleSave();
    },

    removeItem: (id) => {
      set({ items: get().items.filter((i) => i.id !== id) });
      scheduleSave();
    },

    importFromLive: async () => {
      const devices: DiscoveredDevice[] = await getDevices();
      const existingDeviceChannelIds = new Set(
        get().items.filter((i) => i.deviceId).map((i) => i.deviceId)
      );
      const added: InventoryItem[] = [];
      for (const d of devices) {
        for (const ch of d.channels) {
          if (existingDeviceChannelIds.has(ch.id)) continue;
          added.push({
            id: newId(),
            label: ch.name,
            vendor: d.vendor === 'unknown-dante' ? 'Dante/AES67' : d.vendor,
            model: d.model ?? '',
            band: '',
            role: d.transport === 'aes67' ? 'other' : 'mic',
            quantity: 1,
            coordinate: true,
            source: 'discovered',
            deviceId: ch.id,
          });
        }
      }
      if (added.length) {
        set({ items: [...get().items, ...added] });
        scheduleSave();
      }
      return added.length;
    },

    setCoordination: (coordination) => set({ coordination }),
    setAllocations: (allocations) => set({ allocations }),
  };
});
