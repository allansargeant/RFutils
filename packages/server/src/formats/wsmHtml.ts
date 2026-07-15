/**
 * Parser for the HTML "WSM Coordination Report" WSM can export.
 * Ported from wsm-wwb-bridge/wsm_html.py.
 *
 * The report has one <table id="devices"> per device category (the text of
 * the preceding <div class="deviceTitle">), each row:
 *   #, Name, Stationary device, Frequency range, Frequency, Portable device, Squelch
 * The "Frequency" column (index 4) is the actual assigned channel frequency.
 *
 * The document isn't well-formed XML (unescaped entities, unclosed <img>),
 * so — like the Python original's use of html.parser — we drive a small
 * streaming tag tokenizer rather than an XML DOM.
 */

import type { Channel, CoordinationList } from '@rfwizard/shared';
import { decodeEntities } from './htmlEntities.js';

export function looksLikeWsmHtmlReport(text: string): boolean {
  return text.slice(0, 4000).includes('WSM Coordination Report');
}

interface StartTag {
  kind: 'start';
  tag: string;
  attrs: Record<string, string>;
}
interface EndTag {
  kind: 'end';
  tag: string;
}
interface DataTok {
  kind: 'data';
  data: string;
}
type Token = StartTag | EndTag | DataTok;

function tokenize(html: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < html.length) {
    const lt = html.indexOf('<', i);
    if (lt === -1) {
      const data = html.slice(i);
      if (data) tokens.push({ kind: 'data', data: decodeEntities(data) });
      break;
    }
    if (lt > i) {
      tokens.push({ kind: 'data', data: decodeEntities(html.slice(i, lt)) });
    }
    const gt = html.indexOf('>', lt);
    if (gt === -1) break;
    const rawTag = html.slice(lt + 1, gt);
    i = gt + 1;

    if (rawTag.startsWith('!') || rawTag.startsWith('?')) continue; // comment/doctype/PI
    if (rawTag.startsWith('/')) {
      tokens.push({ kind: 'end', tag: rawTag.slice(1).trim().toLowerCase() });
      continue;
    }
    const body = rawTag.replace(/\/$/, '').trim();
    const spaceIdx = body.search(/\s/);
    const tag = (spaceIdx === -1 ? body : body.slice(0, spaceIdx)).toLowerCase();
    const attrs: Record<string, string> = {};
    if (spaceIdx !== -1) {
      const attrStr = body.slice(spaceIdx + 1);
      const attrRe = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*(?:=\s*("[^"]*"|'[^']*'|[^\s"'>]+))?/g;
      let m: RegExpExecArray | null;
      while ((m = attrRe.exec(attrStr)) !== null) {
        const key = m[1]!.toLowerCase();
        let val = m[2] ?? '';
        if (val && (val[0] === '"' || val[0] === "'")) val = val.slice(1, -1);
        attrs[key] = decodeEntities(val);
      }
    }
    tokens.push({ kind: 'start', tag, attrs });
  }
  return tokens;
}

/** Mirrors the Python _DeviceTableParser state machine exactly. */
function parseDeviceRows(html: string): Array<[string | null, string[]]> {
  const rows: Array<[string | null, string[]]> = [];
  let category: string | null = null;
  let categoryBuf: string[] = [];
  let inDeviceTitle = false;
  let inDevicesTable = false;
  let inRow = false;
  let inCell = false;
  let currentRow: string[] = [];
  let currentCellBuf: string[] = [];

  for (const tok of tokenize(html)) {
    if (tok.kind === 'start') {
      const { tag, attrs } = tok;
      if (tag === 'div' && attrs['class'] === 'deviceTitle') {
        inDeviceTitle = true;
        categoryBuf = [];
      } else if (tag === 'table' && attrs['id'] === 'devices') {
        inDevicesTable = true;
      } else if (inDevicesTable && tag === 'tr') {
        inRow = true;
        currentRow = [];
      } else if (inRow && tag === 'td') {
        inCell = true;
        currentCellBuf = [];
      }
    } else if (tok.kind === 'end') {
      const tag = tok.tag;
      if (tag === 'div' && inDeviceTitle) {
        inDeviceTitle = false;
        category = categoryBuf.join('').trim().replace(/:+$/, '');
      } else if (tag === 'table' && inDevicesTable) {
        inDevicesTable = false;
      } else if (tag === 'tr' && inRow) {
        inRow = false;
        if (currentRow.length) rows.push([category, currentRow]);
      } else if (tag === 'td' && inCell) {
        inCell = false;
        currentRow.push(currentCellBuf.join('').trim());
      }
    } else {
      if (inDeviceTitle) categoryBuf.push(tok.data);
      else if (inCell) currentCellBuf.push(tok.data);
    }
  }
  return rows;
}

export function readWsmHtmlReport(text: string): CoordinationList {
  const parsedRows = parseDeviceRows(text);
  const channels: Channel[] = [];

  for (const [category, cellsRaw] of parsedRows) {
    const cells = [...cellsRaw, '', '', '', '', '', '', ''].slice(0, 7);
    const [, name, stationary, , freqCell, portable, squelch] = cells;
    const freqMhz = Number((freqCell ?? '').toUpperCase().replace('MHZ', '').trim());
    if (!Number.isFinite(freqMhz) || (freqCell ?? '').trim() === '') continue;

    const notesParts: string[] = [];
    if (portable) notesParts.push(`TX: ${portable}`);
    if (squelch) notesParts.push(`squelch ${squelch}`);

    channels.push({
      name: name || `CH ${channels.length + 1}`,
      frequencyMhz: freqMhz,
      zone: category,
      deviceType: stationary || null,
      manufacturer: 'Sennheiser',
      notes: notesParts.join(', ') || null,
    });
  }
  return { channels, sourceFormat: 'wsm-html-report' };
}
