import { describe, it, expect } from 'vitest';
import { BUILTIN_PLUGINS, renderProgramCommand, pluginToProfile } from '@rfutils/shared';

describe('product plugin catalog', () => {
  it('has unique ids and one plugin per product', () => {
    const ids = BUILTIN_PLUGINS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    // Shure product lines are separate plugins, per design.
    for (const id of ['shure-ulxd', 'shure-axient-digital', 'shure-qlxd']) {
      expect(ids).toContain(id);
    }
  });

  it('programmable plugins carry a Shure command template; others do not claim program', () => {
    for (const p of BUILTIN_PLUGINS) {
      if (p.control?.capabilities.program) {
        expect(p.control.transport).toBe('shure-command-strings');
        expect(typeof p.control.programTemplate).toBe('string');
      }
    }
  });

  it('renders program templates with channel + frequency', () => {
    expect(renderProgramCommand('< SET {ch} FREQUENCY {khz6} >', 1, 470.125)).toBe(
      '< SET 1 FREQUENCY 470125 >'
    );
    expect(renderProgramCommand('< SET {ch} CHAN_FREQ {khz6} >', 2, 606.5)).toBe(
      '< SET 2 CHAN_FREQ 606500 >'
    );
    expect(renderProgramCommand('{mhz3}/{khz}', 1, 500.05)).toBe('500.050/500050');
  });

  it('derives a coordination profile from a plugin', () => {
    const ulxd = BUILTIN_PLUGINS.find((p) => p.id === 'shure-ulxd')!;
    const profile = pluginToProfile(ulxd);
    expect(profile.protocol).toBe('shure-command-strings');
    expect(profile.tuningStepKhz).toBe(ulxd.tuningStepKhz);
    const dpa = pluginToProfile(BUILTIN_PLUGINS.find((p) => p.id === 'dpa-nseries')!);
    expect(dpa.protocol).toBe('other');
  });
});
