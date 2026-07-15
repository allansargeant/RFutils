/**
 * Ofcom PMSE licence schedule PDF parser.
 *
 * Ported from pmse-to-wwb/backend/parser.py, which used pdfplumber (table
 * detection + positional cropping). pdfjs-dist has no table detector, so this
 * reconstructs page geometry from positioned text runs:
 *
 *   1. Text items (str + x/y/width) are grouped into visual lines by y.
 *   2. Metadata (licence no, dates, licensee box) is read from line text and
 *      a top-right positional crop, mirroring the Python `_parse_licensee_box`.
 *   3. The assignment table is reconstructed by clustering item x-positions
 *      into columns anchored on the "Radio Equipment"/"Frequency" header row,
 *      then each data row's cells are mapped to Assignment fields.
 *
 * ⚠️ VALIDATION STATUS: the original pdfplumber logic was tuned against real
 * Ofcom licence PDFs; this geometric re-implementation has NOT yet been run
 * against one (none was available at port time). The metadata regexes are a
 * faithful port and low-risk; the *table geometry* is the part to validate
 * against a real licence schedule — parseLicencePdf() surfaces a warning to
 * that effect whenever it produces assignments. See docs and README.
 */

import type { Assignment, ParsedLicence } from '@rfwizard/shared';
import { emptyLicence } from '@rfwizard/shared';

// pdfjs-dist legacy ESM build works under Node.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

const NGR_SITE_RE = /^([A-Z]{2}\s?\d{3}\s?\d{3})\s+(.*)$/;
const FREQ_RE = /([\d.]+)\s*MHz/;
const FEE_RE = /([A-Z0-9*]+)\s*\n?\(([^)]+)\)\s*\n?£?([\d.]+)/;
const PERIOD_RE =
  /([\d:]+),\s*(\d+\s+\w+\s+\d+)\s*\nto\s*\n([\d:]+),\s*(\d+\s+\w+\s+\d+)/m;

interface TextItem {
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface PageGeometry {
  width: number;
  height: number;
  items: TextItem[];
  /** Visual lines, top-to-bottom, each a list of items left-to-right. */
  lines: TextItem[][];
  text: string;
}

function clean(cell: string | null | undefined): string {
  return (cell ?? '').replace(/\n/g, ' ').trim();
}

async function loadPages(data: Uint8Array): Promise<PageGeometry[]> {
  const doc = await pdfjsLib.getDocument({ data, useSystemFonts: true }).promise;
  const pages: PageGeometry[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    const items: TextItem[] = [];
    for (const raw of content.items as any[]) {
      if (typeof raw.str !== 'string' || raw.str === '') continue;
      const t = raw.transform as number[];
      const x = t[4] ?? 0;
      const yBaseline = t[5] ?? 0;
      // pdfjs y is measured from the bottom; convert to a top-origin y so
      // ordering/cropping matches pdfplumber's top-left coordinate system.
      const yTop = viewport.height - yBaseline;
      items.push({ str: raw.str, x, y: yTop, width: raw.width ?? 0, height: raw.height ?? 0 });
    }
    const lines = groupLines(items);
    pages.push({
      width: viewport.width,
      height: viewport.height,
      items,
      lines,
      text: lines.map((ln) => ln.map((i) => i.str).join(' ').replace(/\s+/g, ' ').trim()).join('\n'),
    });
  }
  return pages;
}

/** Group items into lines by y proximity, then sort each line left-to-right. */
function groupLines(items: TextItem[], yTolerance = 3): TextItem[][] {
  const sorted = [...items].sort((a, b) => a.y - b.y || a.x - b.x);
  const lines: TextItem[][] = [];
  let current: TextItem[] = [];
  let currentY = Number.NaN;
  for (const item of sorted) {
    if (current.length === 0 || Math.abs(item.y - currentY) <= yTolerance) {
      current.push(item);
      currentY = Number.isNaN(currentY) ? item.y : (currentY + item.y) / 2;
    } else {
      lines.push(current.sort((a, b) => a.x - b.x));
      current = [item];
      currentY = item.y;
    }
  }
  if (current.length) lines.push(current.sort((a, b) => a.x - b.x));
  return lines;
}

function parseMetadata(pageText: string, result: ParsedLicence): void {
  const grab = (re: RegExp): string | null => {
    const m = re.exec(pageText);
    return m ? m[1]! : null;
  };
  result.licenceNo = grab(/Licence No:\s*([\w/]+)/) ?? result.licenceNo;
  result.noticeOfVariationNo = grab(/Notice of Variation No:\s*(\d+)/) ?? result.noticeOfVariationNo;
  const total = grab(/Total assignments:\s*(\d+)/);
  if (total) result.totalAssignments = parseInt(total, 10);
  result.licenceStart = grab(/Licence Start Date:\s*(\d+\s+\w+\s+\d+)/) ?? result.licenceStart;
  result.licenceEnd = grab(/Licence End Date:\s*(\d+\s+\w+\s+\d+)/) ?? result.licenceEnd;
  result.pmseRef = grab(/PMSE ref\.?:\s*(\S+)/) ?? result.pmseRef;
  const lref = /Licensee.s ref\.?:\s*(.+?)\s*;\s*PMSE/.exec(pageText);
  if (lref) result.licenseeRef = lref[1]!.trim();
}

/** Mirrors pdfplumber `_parse_licensee_box`: crop the top-right box, read
 * name (first line) and address (remaining lines joined). */
function parseLicenseeBox(page: PageGeometry): [string, string] {
  const cropItems = page.items.filter((i) => i.x >= 605 && i.y >= 0 && i.y <= 130);
  const cropLines = groupLines(cropItems)
    .map((ln) => ln.map((i) => i.str).join(' ').replace(/\s+/g, ' ').trim())
    .filter((l) => l !== '' && l !== 'Licensee:');
  if (cropLines.length === 0) return ['', ''];
  return [cropLines[0]!, cropLines.slice(1).join(', ')];
}

/**
 * Reconstruct table rows from a page by anchoring columns on the header row.
 * Returns rows as arrays of cell strings, columns ordered left-to-right.
 */
function extractTableRows(page: PageGeometry): string[][] {
  const headerIdx = page.lines.findIndex((ln) =>
    ln.map((i) => i.str).join(' ').includes('Radio Equipment')
  );
  if (headerIdx === -1) return [];

  // Column x-anchors: the left edge of each header item defines a column start.
  const headerLine = page.lines[headerIdx]!;
  const colStarts = headerLine.map((i) => i.x).sort((a, b) => a - b);
  if (colStarts.length < 2) return [];

  const assignToColumn = (x: number): number => {
    // nearest column whose start is <= x (fall back to first)
    let col = 0;
    for (let c = 0; c < colStarts.length; c++) {
      if (x + 1 >= colStarts[c]!) col = c;
    }
    return col;
  };

  const rows: string[][] = [];
  for (let li = headerIdx + 1; li < page.lines.length; li++) {
    const line = page.lines[li]!;
    const cells: string[] = new Array(colStarts.length).fill('');
    for (const item of line) {
      const c = assignToColumn(item.x);
      cells[c] = cells[c] ? `${cells[c]} ${item.str}` : item.str;
    }
    // Stop at obvious end-of-table / footer lines.
    const joined = cells.join(' ').trim();
    if (joined === '') continue;
    if (/^Total assignments:/.test(joined)) break;
    rows.push(cells);
  }
  return rows;
}

function parseAssignmentsFromRows(rows: string[][], result: ParsedLicence): void {
  for (const row of rows) {
    if (!row || row.length < 12) continue;
    const col0 = row[0] ?? '';
    const freqMatch = FREQ_RE.exec(row[1] ?? '');
    if (!freqMatch) continue;

    const equipLines = col0.split('\n').map((l) => l.trim()).filter(Boolean);
    const equipmentType = equipLines[0] ?? '';
    const model = equipLines[1] ?? '';

    const ngrSiteRaw = row[9] ?? '';
    const siteLines = ngrSiteRaw.split('\n').filter((l) => l.trim());
    let ngr = '';
    let site = '';
    let restrictions = '';
    if (siteLines.length) {
      const m = NGR_SITE_RE.exec(siteLines[0]!.trim());
      if (m) {
        ngr = m[1]!;
        site = m[2]!;
      } else {
        site = siteLines[0]!.trim();
      }
      const extra = siteLines
        .slice(1)
        .map((l) => l.trim())
        .filter((l) => l && l !== '-');
      restrictions = extra.join(' ');
    }

    let periodStart = '';
    let periodEnd = '';
    const pm = PERIOD_RE.exec(row[10] ?? '');
    if (pm) {
      periodStart = `${pm[1]} ${pm[2]}`;
      periodEnd = `${pm[3]} ${pm[4]}`;
    }

    let feeCategory = '';
    let feeType = '';
    let feeAmount = '';
    const fm = FEE_RE.exec(row[11] ?? '');
    if (fm) {
      feeCategory = fm[1]!;
      feeType = fm[2]!;
      feeAmount = fm[3]!;
    }

    const assignment: Assignment = {
      equipmentType,
      model,
      frequencyMhz: Math.round(parseFloat(freqMatch[1]!) * 1000) / 1000,
      bandwidth: clean(row[2]),
      maxPower: clean(row[3]),
      emissionClass: row[4] ? clean(row[4]).split(' ')[0]! : '',
      ngrTransmit: ngr,
      site,
      restrictions,
      periodStart,
      periodEnd,
      feeCategory,
      feeType,
      feeAmount,
    };
    result.assignments.push(assignment);
  }
}

export async function parseLicencePdf(data: Uint8Array): Promise<ParsedLicence> {
  const result = emptyLicence();
  const pages = await loadPages(data);

  if (pages.length) parseMetadata(pages[0]!.text, result);

  for (const page of pages) {
    if (!result.licenceNo) parseMetadata(page.text, result);
    if (!result.licensee && page.text.includes('Licensee:')) {
      const [name, address] = parseLicenseeBox(page);
      result.licensee = name;
      result.licenseeAddress = address;
    }
    parseAssignmentsFromRows(extractTableRows(page), result);
  }

  if (result.assignments.length === 0) {
    result.warnings.push(
      'No frequency assignments could be found in this PDF. It may not be an ' +
        'Ofcom PMSE schedule, or its layout is unrecognized.'
    );
  } else {
    if (
      result.totalAssignments &&
      result.assignments.length !== result.totalAssignments
    ) {
      result.warnings.push(
        `PDF header states ${result.totalAssignments} assignments but ` +
          `${result.assignments.length} were parsed. Please verify the output before use.`
      );
    }
    // Honesty flag: the geometric table reconstruction has not been validated
    // against a real Ofcom PDF (see module header). Always surface this.
    result.warnings.push(
      "RFWizard's PDF table reader is a geometric re-implementation not yet " +
        'validated against a real Ofcom licence — check the parsed assignments ' +
        'against the source PDF before importing into Wireless Workbench.'
    );
  }

  return result;
}
