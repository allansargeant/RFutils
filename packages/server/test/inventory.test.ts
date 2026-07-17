import { describe, it, expect } from 'vitest';
import { channelsNeeded, channelNames, type Inventory, type InventoryItem } from '@rfutils/shared';

function item(over: Partial<InventoryItem>): InventoryItem {
  return {
    id: 'x',
    label: 'Ch',
    vendor: '',
    model: '',
    band: '',
    role: 'mic',
    quantity: 1,
    coordinate: true,
    source: 'manual',
    ...over,
  };
}

describe('inventory helpers', () => {
  it('counts only channels flagged for coordination', () => {
    const inv: Inventory = {
      items: [
        item({ id: 'a', quantity: 2 }),
        item({ id: 'b', quantity: 3, coordinate: false }),
        item({ id: 'c', quantity: 1 }),
      ],
    };
    expect(channelsNeeded(inv)).toBe(3);
  });

  it('expands quantities into per-channel names', () => {
    const inv: Inventory = {
      items: [
        item({ id: 'a', label: 'Vocal', quantity: 1 }),
        item({ id: 'b', label: 'Band', quantity: 3 }),
        item({ id: 'c', label: 'Spare', quantity: 1, coordinate: false }),
      ],
    };
    expect(channelNames(inv)).toEqual(['Vocal', 'Band 1', 'Band 2', 'Band 3']);
  });

  it('ignores zero/negative quantities', () => {
    const inv: Inventory = { items: [item({ quantity: 0 }), item({ id: 'y', quantity: -2 })] };
    expect(channelsNeeded(inv)).toBe(0);
    expect(channelNames(inv)).toEqual([]);
  });
});
