/**
 * Generic, header-driven CSV reader. Ported from wsm-wwb-bridge/csv_generic.py.
 *
 * Neither Shure nor Sennheiser publish a single fixed schema for
 * coordination/inventory exports. This reader detects the delimiter, then
 * fuzzy-matches whatever headers are present onto the internal Channel
 * fields. Call `sniffMapping` for a best guess, let the user confirm/adjust
 * it, then call `readRows` with the confirmed mapping.
 */

import type { Channel, CoordinationList, ChannelField, FieldMapping } from '../index.js';
import { parseFrequencyToMhz } from './freqParse.js';
import { parseCsvNonEmpty, writeCsv } from './csvUtil.js';
import { displayFrequency } from '../index.js';

export type { ChannelField, FieldMapping };

// Field name -> lowercase aliases we'll match against header cells.
export const FIELD_ALIASES: Record<ChannelField, string[]> = {
  name: ['name', 'label', 'channel name', 'tx name', 'device name', 'talent'],
  frequencyMhz: [
    'frequency',
    'freq',
    'frequency (mhz)',
    'freq (mhz)',
    'frequency mhz',
    'mhz',
    'freq mhz',
    'rf frequency',
  ],
  group: ['group', 'band group', 'inclusion group'],
  channel: ['channel', 'ch', 'channel #', 'channel number', 'chan'],
  deviceType: ['type', 'device type', 'tx type', 'model', 'device'],
  manufacturer: ['manufacturer', 'make', 'brand'],
  notes: ['notes', 'comment', 'comments', 'description'],
  zone: ['zone', 'rf zone'],
};

export const CHANNEL_FIELDS = Object.keys(FIELD_ALIASES) as ChannelField[];

const CANDIDATE_DELIMITERS = [',', ';', '\t', '|', ':'];

export function sniffDelimiter(sample: string): string {
  // Approximate csv.Sniffer: pick the delimiter with the most consistent,
  // highest count across the first few lines.
  const lines = sample.split(/\r?\n/).filter((l) => l.trim() !== '').slice(0, 10);
  if (lines.length === 0) return ',';
  let best = ',';
  let bestScore = -1;
  for (const delim of CANDIDATE_DELIMITERS) {
    const counts = lines.map((l) => l.split(delim).length - 1);
    const min = Math.min(...counts);
    const max = Math.max(...counts);
    if (max === 0) continue;
    // Reward consistency (min>0, low spread) and higher field counts.
    const consistent = min > 0 ? 1 : 0;
    const score = consistent * 100 + min * 10 - (max - min);
    if (score > bestScore) {
      bestScore = score;
      best = delim;
    }
  }
  // Fall back to whichever common delimiter actually appears.
  if (bestScore <= 0) {
    for (const delim of [';', '\t', ',', '|']) {
      if (sample.includes(delim)) return delim;
    }
    return ',';
  }
  return best;
}

export interface HeaderAndRows {
  delimiter: string;
  header: string[];
  rows: string[][];
}

export function readHeaderAndRows(text: string): HeaderAndRows {
  const delimiter = sniffDelimiter(text.slice(0, 4096));
  const rows = parseCsvNonEmpty(text, delimiter);
  if (rows.length === 0) return { delimiter, header: [], rows: [] };
  return { delimiter, header: rows[0]!, rows: rows.slice(1) };
}

export function sniffMapping(header: string[]): FieldMapping {
  const mapping: FieldMapping = {};
  for (const field of CHANNEL_FIELDS) mapping[field] = null;
  const normalized = header.map((h) => h.trim().toLowerCase());
  for (const field of CHANNEL_FIELDS) {
    const aliases = FIELD_ALIASES[field];
    for (let idx = 0; idx < normalized.length; idx++) {
      if (aliases.includes(normalized[idx]!)) {
        mapping[field] = idx;
        break;
      }
    }
  }
  return mapping;
}

export function readRows(
  dataRows: string[][],
  mapping: FieldMapping,
  sourceFormat = 'generic-csv'
): CoordinationList {
  if (mapping.name == null && mapping.frequencyMhz == null) {
    throw new Error('At least name or frequency must be mapped to a column');
  }

  const channels: Channel[] = [];
  dataRows.forEach((row, i) => {
    const rowNum = i + 1;
    const cell = (field: ChannelField): string | null => {
      const idx = mapping[field];
      if (idx == null || idx >= row.length) return null;
      const value = row[idx]!.trim();
      return value || null;
    };

    const freqRaw = cell('frequencyMhz');
    if (!freqRaw) return;
    let freqMhz: number;
    try {
      freqMhz = parseFrequencyToMhz(freqRaw);
    } catch {
      return;
    }

    channels.push({
      name: cell('name') ?? `CH ${rowNum}`,
      frequencyMhz: freqMhz,
      group: cell('group'),
      channel: cell('channel'),
      deviceType: cell('deviceType'),
      manufacturer: cell('manufacturer'),
      notes: cell('notes'),
      zone: cell('zone'),
    });
  });
  return { channels, sourceFormat };
}

export function parseGenericCsv(text: string, mapping?: FieldMapping): CoordinationList {
  const { header, rows } = readHeaderAndRows(text);
  return readRows(rows, mapping ?? sniffMapping(header));
}

export function writeGenericCsv(list: CoordinationList): string {
  const rows: (string | number)[][] = [
    ['Name', 'Frequency (MHz)', 'Zone', 'Group', 'Channel', 'Type', 'Manufacturer', 'Notes'],
  ];
  for (const ch of list.channels) {
    rows.push([
      ch.name,
      displayFrequency(ch),
      ch.zone ?? '',
      ch.group ?? '',
      ch.channel ?? '',
      ch.deviceType ?? '',
      ch.manufacturer ?? '',
      ch.notes ?? '',
    ]);
  }
  return writeCsv(rows);
}
