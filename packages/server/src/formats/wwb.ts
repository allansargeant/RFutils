/**
 * Shure Wireless Workbench (WWB) import/export.
 * Ported from wsm-wwb-bridge/wwb.py.
 *
 * WWB's "Import Frequencies from File" accepts a flat list of MHz values
 * (<=3 decimals). That's the one format WWB is certain to accept, so it's
 * the default/safe export. write_wwb_inventory_csv is a best-effort
 * structured shape (columns are user-configurable in real WWB).
 */

import type { Channel, CoordinationList } from '@rfwizard/shared';
import { displayFrequency } from '@rfwizard/shared';
import { formatMhz, parseFrequencyToMhz } from './freqParse.js';
import { writeCsv } from './csvUtil.js';
import { readHeaderAndRows, readRows, sniffMapping } from './csvGeneric.js';

export function writeWwbFrequencyList(list: CoordinationList): string {
  const lines = list.channels.map((ch) => formatMhz(ch.frequencyMhz));
  return lines.join('\n') + '\n';
}

export function writeWwbInventoryCsv(list: CoordinationList): string {
  const rows: (string | number)[][] = [
    ['Name', 'Frequency', 'Group', 'Channel', 'Type', 'Manufacturer', 'Notes'],
  ];
  for (const ch of list.channels) {
    rows.push([
      ch.name,
      displayFrequency(ch),
      ch.group ?? '',
      ch.channel ?? '',
      ch.deviceType ?? '',
      ch.manufacturer ?? '',
      ch.notes ?? '',
    ]);
  }
  return writeCsv(rows);
}

export function looksLikeBareFrequencyList(rows: string[][]): boolean {
  for (const row of rows.slice(0, 5)) {
    for (const cellRaw of row) {
      const cell = cellRaw.trim();
      if (!cell) continue;
      try {
        parseFrequencyToMhz(cell);
      } catch {
        return false;
      }
    }
  }
  return true;
}

export function readWwbFile(text: string): CoordinationList {
  const { header, rows } = readHeaderAndRows(text);
  const allRows = header.length ? [header, ...rows] : rows;

  if (looksLikeBareFrequencyList(allRows)) {
    const channels: Channel[] = [];
    let n = 1;
    for (const row of allRows) {
      for (const cellRaw of row) {
        const cell = cellRaw.trim();
        if (!cell) continue;
        let freq: number;
        try {
          freq = parseFrequencyToMhz(cell);
        } catch {
          continue;
        }
        channels.push({ name: `CH ${n}`, frequencyMhz: freq });
        n++;
      }
    }
    return { channels, sourceFormat: 'wwb-frequency-list' };
  }

  const mapping = sniffMapping(header);
  return readRows(rows, mapping, 'wwb-csv');
}
