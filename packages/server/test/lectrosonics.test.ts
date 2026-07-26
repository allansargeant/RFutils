import { describe, it, expect } from 'vitest';
import { BUILTIN_PLUGINS, renderProgramCommand } from '@rfutils/shared';
import { findPluginForModel } from '../src/plugins/registry.js';
import {
  frameCommand,
  splitFrames,
  parseTelemetry,
  LECTRO_PROGRAM_TEMPLATE,
} from '../src/monitor/discovery/lectrosonicsProtocol.js';

describe('lectrosonics protocol (placeholder wire format)', () => {
  it('frames a command with the terminator', () => {
    expect(frameCommand('SET 1 FREQ 606500')).toBe('SET 1 FREQ 606500\r');
  });

  it('splits frames on CR/LF/CRLF and keeps a partial tail', () => {
    const { frames, rest } = splitFrames('RX 1 FREQ 606500\rRX 2 FREQ 60700');
    expect(frames).toEqual(['RX 1 FREQ 606500']);
    expect(rest).toBe('RX 2 FREQ 60700');
  });

  it('parses a telemetry frame into a channel snapshot', () => {
    const t = parseTelemetry('RX 1 NAME Vocal FREQ 606500 RF 82 BATT 90');
    expect(t).toMatchObject({ channel: 1, name: 'Vocal', frequencyMhz: 606.5, rfLevel: 82, batteryPercent: 90 });
    expect(parseTelemetry('garbage line')).toBeNull();
  });

  it('renders the default program template', () => {
    expect(renderProgramCommand(LECTRO_PROGRAM_TEMPLATE, 3, 606.5)).toBe('SET 3 FREQ 606500');
  });

  it('auto-matches a Lectrosonics model to its programmable plugin', () => {
    expect(findPluginForModel('DSQD', BUILTIN_PLUGINS)?.id).toBe('lectrosonics-dsqd');
    expect(findPluginForModel('Duet', BUILTIN_PLUGINS)?.id).toBe('lectrosonics-dsqd');
  });
});
