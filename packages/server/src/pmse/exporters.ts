/**
 * PMSE → WWB export helpers. Ported from pmse-to-wwb/backend/exporters.py.
 */

import type { Assignment } from '@rfutils/shared';
import { writeCsv } from '../formats/csvUtil.js';

export function suggestedNames(assignments: Assignment[]): string[] {
  return assignments.map((a, idx) => {
    const i = idx + 1;
    const base = a.model || a.equipmentType || 'Ch';
    return `${base}-${String(i).padStart(2, '0')}`;
  });
}

/** WWB6/7 documented import format: bare MHz values, <=3 decimals, one per
 * line, no duplicates, no extra text. */
export function toWwbFrequencyList(assignments: Assignment[]): string {
  const seen = new Set<string>();
  const lines: string[] = [];
  for (const a of assignments) {
    const freq = a.frequencyMhz.toFixed(3);
    if (seen.has(freq)) continue;
    seen.add(freq);
    lines.push(freq);
  }
  return lines.join('\n') + '\n';
}

export function toReferenceCsv(assignments: Assignment[]): string {
  const rows: (string | number)[][] = [
    [
      'Index',
      'Suggested Name',
      'Frequency (MHz)',
      'Equipment Type',
      'Model',
      'Coordination/Fee Group',
      'Site',
      'NGR',
      'Period Start',
      'Period End',
      'Restrictions',
    ],
  ];
  const names = suggestedNames(assignments);
  assignments.forEach((a, idx) => {
    rows.push([
      idx + 1,
      names[idx]!,
      a.frequencyMhz.toFixed(3),
      a.equipmentType,
      a.model,
      a.feeCategory,
      a.site,
      a.ngrTransmit,
      a.periodStart,
      a.periodEnd,
      a.restrictions,
    ]);
  });
  return writeCsv(rows);
}
