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
 *   3. The assignment table is reconstructed by bucketing item x-positions into
 *      the fixed Ofcom ST16 template's columns (see COL_LEFT_EDGES_842) and
 *      merging the ~3 physical lines per assignment into multi-line cells, then
 *      each row's cells are mapped to Assignment fields exactly as the Python
 *      parser did (row[0..4], row[9] NGR/site, row[10] period, row[11] fee).
 *
 * VALIDATION: checked against a real Ofcom PMSE licence schedule (116-assignment
 * NoV, ST16 landscape template) — all 116 assignments, frequencies, sites,
 * periods and fees parse correctly, and the header/licensee metadata match. The
 * column geometry is calibrated to that fixed Ofcom template and scaled by page
 * width; a materially different template revision would need re-calibration.
 */

import type { Assignment, ParsedLicence } from '../index.js';
import { emptyLicence } from '../index.js';

// pdfjs-dist legacy ESM build works under Node.
 
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
  // pdfjs emits ":" and some values (e.g. "J880582" -> "J" + "880582") as
  // separate text runs, so the space-joined line text can read
  // "Licence Start Date : 23 Jun 2026". These regexes are the Python
  // originals made tolerant of a space before the colon.
  const grab = (re: RegExp): string | null => {
    const m = re.exec(pageText);
    return m ? m[1]! : null;
  };
  result.licenceNo = grab(/Licence No\s*:\s*([\w/]+)/) ?? result.licenceNo;
  result.noticeOfVariationNo =
    grab(/Notice of Variation No\s*:\s*(\d+)/) ?? result.noticeOfVariationNo;
  const total = grab(/Total assignments\s*:\s*(\d+)/);
  if (total) result.totalAssignments = parseInt(total, 10);
  result.licenceStart = grab(/Licence Start Date\s*:\s*(\d+\s+\w+\s+\d+)/) ?? result.licenceStart;
  result.licenceEnd = grab(/Licence End Date\s*:\s*(\d+\s+\w+\s+\d+)/) ?? result.licenceEnd;
  const pmse = grab(/PMSE\s*ref\.?\s*:\s*([A-Za-z]?\s*\d+)/);
  if (pmse) result.pmseRef = pmse.replace(/\s+/g, '');
  // "Licensee's" can arrive split across runs ("Licen" + "see's"), so anchor on
  // the "…ref : <value> ; PMSE" shape rather than the word "Licensee".
  const lref = /ref\s*\.?\s*:\s*(.+?)\s*;\s*PMSE/.exec(pageText);
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
 * Column left-edge x-positions for the Ofcom ST16 PMSE schedule (the fixed
 * "PROGRAMME MAKING AND SPECIAL EVENTS LICENCE" landscape template), measured
 * from a real licence at pdfjs scale 1 (page width 842). Ofcom generates every
 * PMSE schedule from this same template, so the geometry is stable; boundaries
 * are scaled by the actual page width for DPI robustness. Indices match the
 * form's columns 1-11 plus the trailing Fee column, which is exactly the layout
 * parseAssignmentsFromRows() expects (row[0..4], row[9]=NGR/site, row[10]=period,
 * row[11]=fee — columns 5-8 are ignored).
 */
const COL_LEFT_EDGES_842 = [0, 128, 170, 199, 227, 251, 289, 311, 330, 372, 690, 758];

/** A physical line starts a new assignment when its Frequency column holds an
 * actual frequency like "471.37500" (not "MHz", "200k0", a date, or a header). */
const ROW_START_FREQ = /^\d{2,4}\.\d{2,}$/;

/**
 * Reconstruct table rows from a page. Each assignment spans ~3 physical lines
 * (value / unit / continuation), so we bucket every text run into a column by
 * its x-position, start a new logical row whenever the Frequency column holds a
 * frequency, and merge continuation lines into multi-line cells (joined with
 * "\n", the way pdfplumber presented them to the original parser). Returns rows
 * of 12 cell strings, left-to-right.
 */
function extractTableRows(page: PageGeometry): string[][] {
  const scale = page.width / 842;
  const edges = COL_LEFT_EDGES_842.map((v) => v * scale);
  const colOf = (x: number): number => {
    let col = 0;
    for (let i = 0; i < edges.length; i++) {
      if (x + 0.5 >= edges[i]!) col = i;
    }
    return col;
  };

  const rows: string[][] = [];
  let current: string[] | null = null;
  const flush = (): void => {
    if (current) rows.push(current);
    current = null;
  };

  for (const line of page.lines) {
    const cells: string[] = new Array(edges.length).fill('');
    for (const item of line) {
      const c = colOf(item.x);
      cells[c] = cells[c] ? `${cells[c]} ${item.str}` : item.str;
    }

    if (ROW_START_FREQ.test(cells[1]!.trim())) {
      flush();
      current = cells;
    } else if (current) {
      // continuation line: append each non-empty cell as a new line
      for (let i = 0; i < cells.length; i++) {
        if (cells[i]) current[i] = current[i] ? `${current[i]}\n${cells[i]}` : cells[i]!;
      }
    }
    // lines before the first assignment (page header/metadata) are ignored
  }
  flush();
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
  }

  return result;
}
