/**
 * Parser for Sennheiser WSM's native .wsm project file.
 * Ported from wsm-wwb-bridge/wsm_xml.py.
 *
 * The real per-channel coordinated frequency lives at
 * <WSM><FrequencyManager><Devices><Device><AllocatedFrequency> (kHz), one
 * entry per logical mic/IEM channel — NOT <Port><CurrentFrequency> (the
 * device's own last-known tuning). Verified against a WSM HTML report.
 */

import type { Channel, CoordinationList } from '@rfutils/shared';
import { parseXml, findPath, findChildren, childText } from './domUtil.js';

export function looksLikeWsmXml(text: string): boolean {
  const head = text.replace(/^\s+/, '').slice(0, 200);
  return head.startsWith('<!DOCTYPE WSM>') || head.startsWith('<WSM ');
}

export function readWsmProject(text: string): CoordinationList {
  const root = parseXml(text);
  const channels: Channel[] = [];
  const devicesEl = findPath(root, 'FrequencyManager/Devices');
  if (!devicesEl) return { channels, sourceFormat: 'wsm-project' };

  for (const device of findChildren(devicesEl, 'Device')) {
    const freqRaw = (childText(device, 'AllocatedFrequency') ?? '').trim();
    if (!freqRaw) continue;
    const parsed = Number(freqRaw);
    if (!Number.isFinite(parsed)) continue;
    const freqMhz = parsed / 1000.0;

    const name = (childText(device, 'Name') ?? '').trim() || `CH ${channels.length + 1}`;
    const stationary = (childText(device, 'StationaryDeviceType') ?? '').trim() || null;
    const portable = (childText(device, 'PortableDeviceType') ?? '').trim() || null;
    const squelch = (childText(device, 'SquelchDescription') ?? '').trim();

    const notesParts: string[] = [];
    if (portable) notesParts.push(`TX: ${portable}`);
    if (squelch) notesParts.push(`squelch ${squelch}`);

    channels.push({
      name,
      frequencyMhz: freqMhz,
      deviceType: stationary,
      manufacturer: 'Sennheiser',
      notes: notesParts.join(', ') || null,
    });
  }
  return { channels, sourceFormat: 'wsm-project' };
}
