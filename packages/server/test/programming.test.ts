import { describe, it, expect } from 'vitest';
import { buildShureSetCommand, shureFreqValue } from '../src/programming/shureProgrammer.js';

describe('Shure programming command builder', () => {
  it('formats frequency as 6-digit kHz', () => {
    expect(shureFreqValue(470.125)).toBe('470125');
    expect(shureFreqValue(606.5)).toBe('606500');
    expect(shureFreqValue(500)).toBe('500000');
  });

  it('builds a SET command', () => {
    expect(buildShureSetCommand(1, 470.125)).toBe('< SET 1 FREQUENCY 470125 >');
    expect(buildShureSetCommand('2', 606.5)).toBe('< SET 2 FREQUENCY 606500 >');
  });
});
