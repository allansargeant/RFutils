/**
 * Parser for WWB7's "Coordination report" CSV export.
 * Ported from wsm-wwb-bridge/wwb_report.py.
 *
 * A multi-section printable report (per RF zone: Primary/Backup frequency
 * sections). Rather than track exact section boundaries, we key off the one
 * reliable signal: a data row always has its frequency value, formatted
 * "<number> MHz", in the 5th column (index 4). Headers are tracked as
 * context but a row is only treated as a channel if that check passes.
 */

import type { Channel, CoordinationList } from '../index.js';
import { parseWwbGroupChannel } from './freqParse.js';
import { parseCsvNonEmpty } from './csvUtil.js';

const GROUP_HEADER_RE = /^(.+?)\s*\(\d+\)$/;
const FREQ_CELL_RE = /^[\d.]+\s*MHz$/i;

export function looksLikeWwbReport(text: string): boolean {
  const head = text.slice(0, 4000);
  return head.includes('Coordination report') || /RF zone:/.test(head);
}

export function readWwbReportCsv(text: string): CoordinationList {
  const channels: Channel[] = [];
  let zone: string | null = null;
  let section: 'primary' | 'backup' | null = null;
  let inclusionGroup: string | null = null;

  const rows = parseCsvNonEmpty(text, ',');
  for (const row of rows) {
    const cells = row.map((c) => c.trim());
    if (!cells.some((c) => c)) continue;
    const first = cells[0]!;
    const restEmpty = !cells.slice(1).some((c) => c);

    if (first.startsWith('RF zone:')) {
      zone = first.slice('RF zone:'.length).trim();
      section = null;
      inclusionGroup = null;
      continue;
    }
    if (first.startsWith('Primary frequencies (')) {
      section = 'primary';
      inclusionGroup = null;
      continue;
    }
    if (first.startsWith('Backup frequencies (')) {
      section = 'backup';
      inclusionGroup = null;
      continue;
    }
    if (first === 'Type' && cells.includes('Frequency')) {
      continue; // column header row for the section we already know
    }
    if (restEmpty) {
      const m = GROUP_HEADER_RE.exec(first);
      if (m) {
        inclusionGroup = m[1]!.trim();
        continue;
      }
    }

    if (cells.length >= 5 && FREQ_CELL_RE.test(cells[4]!)) {
      const [type_, band, nameOrSource, groupChannel, freqCell] = cells;
      const freqMhz = Number(freqCell!.toUpperCase().replace('MHZ', '').trim());
      if (!Number.isFinite(freqMhz)) continue;
      const [group, channel] = parseWwbGroupChannel(groupChannel);
      const isBackup = section === 'backup';
      const name =
        nameOrSource ||
        (isBackup ? `Backup ${freqMhz.toFixed(3)}` : `CH ${channels.length + 1}`);
      const deviceType =
        type_ && band ? `${type_} (${band})` : type_ || band || null;
      channels.push({
        name,
        frequencyMhz: freqMhz,
        zone,
        group,
        channel,
        deviceType,
        inclusionGroup,
        isBackup,
      });
    }
  }

  return { channels, sourceFormat: 'wwb-report-csv' };
}
