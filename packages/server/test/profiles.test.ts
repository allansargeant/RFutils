import { describe, it, expect } from 'vitest';
import { builtinCatalog, deriveCoordDefaults } from '@rfutils/shared';

describe('equipment profile catalog', () => {
  const { profiles, bandPresets } = builtinCatalog();

  it('has unique profile and band ids', () => {
    expect(new Set(profiles.map((p) => p.id)).size).toBe(profiles.length);
    expect(new Set(bandPresets.map((b) => b.id)).size).toBe(bandPresets.length);
  });

  it('has sane profile values', () => {
    for (const p of profiles) {
      expect(p.tuningStepKhz).toBeGreaterThan(0);
      expect(p.occupiedBandwidthKhz).toBeGreaterThan(0);
      expect(p.recommendedSpacingMhz).toBeGreaterThan(0);
      // nothing is claimed as datasheet-verified
      expect(p.verified).toBe(false);
    }
  });

  it('has valid, ascending band-preset ranges', () => {
    for (const b of bandPresets) {
      expect(b.ranges.length).toBeGreaterThan(0);
      for (const r of b.ranges) {
        expect(r.endMhz).toBeGreaterThan(r.startMhz);
      }
    }
  });

  it('profile defaultBandPresetId always resolves to a real preset', () => {
    const ids = new Set(bandPresets.map((b) => b.id));
    for (const p of profiles) {
      if (p.defaultBandPresetId) expect(ids.has(p.defaultBandPresetId)).toBe(true);
    }
  });
});

describe('deriveCoordDefaults', () => {
  const catalog = builtinCatalog();

  it('falls back to generic defaults with no profiles', () => {
    expect(deriveCoordDefaults([undefined, undefined], catalog)).toEqual({
      minSpacingMhz: 0.4,
      stepMhz: 0.025,
    });
  });

  it('takes the widest recommended spacing across the gear mix', () => {
    // EW-D recommends 0.6, EW-DX 0.35 → mix should use 0.6 so both are happy.
    const d = deriveCoordDefaults(['sennheiser-ewd', 'sennheiser-ewdx'], catalog);
    expect(d.minSpacingMhz).toBe(0.6);
    expect(d.stepMhz).toBe(0.025);
    expect(d.bandPresetId).toBe('uk-uhf-core');
  });
});
