/**
 * Readers for Shure Wireless Workbench's native XML formats.
 * Ported from wsm-wwb-bridge/wwb_xml.py — see that file for the full
 * reverse-engineering notes.
 *
 *   .shw  "Show" file, root <show>. Device inventory = what's really on the gear.
 *   .cws  "Coordination Workspace", root <coord_workspace_ex_root>. Candidate pool.
 *
 * A .shw also embeds a workspace, so read prefers the device inventory when
 * present and falls back to the freq_entry candidate pool otherwise.
 */

import type { Channel, CoordinationList } from '@rfwizard/shared';
import { parseWwbGroupChannel } from './freqParse.js';
import {
  parseXml,
  iterDescendants,
  childText,
  findChild,
  findChildren,
  attr,
  tagName,
} from './domUtil.js';

export function looksLikeWwbXml(text: string): boolean {
  const head = text.replace(/^\s+/, '').slice(0, 200);
  return head.startsWith('<show ') || head.startsWith('<coord_workspace_ex_root');
}

function readShwInventory(root: any): CoordinationList {
  const channels: Channel[] = [];
  for (const device of iterDescendants(root, 'device')) {
    const manufacturer = (childText(device, 'manufacturer') ?? '').trim() || null;
    const model = (childText(device, 'model') ?? '').trim() || null;
    const band = (childText(device, 'band') ?? '').trim() || null;
    const zone = (childText(device, 'zone') ?? '').trim() || null;
    for (const ch of findChildren(device, 'channel')) {
      const freqRaw = (childText(ch, 'frequency') ?? '').trim();
      if (!freqRaw || freqRaw === '0') continue;
      const parsed = Number(freqRaw);
      if (!Number.isFinite(parsed)) continue;
      const freqMhz = parsed / 1000.0;
      const name = (childText(ch, 'channel_name') ?? '').trim() || `CH ${channels.length + 1}`;
      const [group, channel] = parseWwbGroupChannel(childText(ch, 'group_channel'));
      channels.push({
        name,
        frequencyMhz: freqMhz,
        zone,
        group,
        channel,
        deviceType: band,
        manufacturer,
        notes: model ? `${model} ch${attr(ch, 'number')}` : null,
      });
    }
  }
  return { channels, sourceFormat: 'wwb-shw' };
}

function readCwsCandidates(root: any): CoordinationList {
  const channels: Channel[] = [];
  for (const entry of iterDescendants(root, 'freq_entry')) {
    const value = (childText(entry, 'value') ?? '').trim();
    if (!value) continue;
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) continue;
    const freqMhz = parsed / 1000.0;

    const compatKey = findChild(entry, 'compat_key');
    const zone = compatKey ? childText(compatKey, 'zone') : null;
    const series = compatKey ? childText(compatKey, 'series') : null;
    const mode = compatKey ? childText(compatKey, 'mode') : null;
    const deviceType = [series, mode].filter((p) => p).join('/') || null;
    const [group, channel] = parseWwbGroupChannel(childText(entry, 'gr_ch'));
    const name = (childText(entry, 'source_name') ?? '').trim() || `CH ${channels.length + 1}`;
    channels.push({
      name,
      frequencyMhz: freqMhz,
      zone,
      group,
      channel,
      deviceType,
      manufacturer: (childText(entry, 'manufacturer') ?? '').trim() || null,
    });
  }
  return { channels, sourceFormat: 'wwb-cws' };
}

export function readWwbXml(text: string): CoordinationList {
  const root = parseXml(text);
  // Python: prefer inventory when root.find(".//inventory/device") exists
  // (a descendant search), else fall back to the freq_entry candidate pool.
  if (tagName(root) === 'show') {
    const hasInventoryDevice = iterDescendants(root, 'inventory').some(
      (inv) => findChild(inv, 'device') !== null
    );
    if (hasInventoryDevice) return readShwInventory(root);
  }
  return readCwsCandidates(root);
}
