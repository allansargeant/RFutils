/**
 * Minimal HTML entity decoder. Python's html.parser decodes character
 * references in data (convert_charrefs=True by default); we replicate the
 * common ones plus numeric refs, which is all the WSM report needs.
 */

const NAMED: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  ndash: '–',
  mdash: '—',
  rarr: '→',
  hellip: '…',
  deg: '°',
  micro: 'µ',
  plusmn: '±',
  times: '×',
  divide: '÷',
  copy: '©',
  reg: '®',
  trade: '™',
  pound: '£',
  euro: '€',
};

// HTML (and Python's html.parser) decodes a set of legacy named entities
// even without the trailing ';' — e.g. "&micro" in real WSM reports.
const LEGACY_NO_SEMICOLON = new Set([
  'amp',
  'lt',
  'gt',
  'quot',
  'nbsp',
  'copy',
  'reg',
  'micro',
  'deg',
  'plusmn',
  'times',
  'divide',
  'pound',
]);

// Longest-first alternation so e.g. "plusmn" wins over any shorter prefix.
const LEGACY_ALT = [...LEGACY_NO_SEMICOLON]
  .sort((a, b) => b.length - a.length)
  .join('|');
const LEGACY_RE = new RegExp(`&(${LEGACY_ALT})`, 'g');

export function decodeEntities(text: string): string {
  if (!text.includes('&')) return text;
  // Pass 1: semicolon-terminated numeric and named references.
  let out = text.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]*);/g, (match, body: string) => {
    if (body[0] === '#') {
      const isHex = body[1] === 'x' || body[1] === 'X';
      const code = parseInt(body.slice(isHex ? 2 : 1), isHex ? 16 : 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    const named = NAMED[body];
    return named ?? match;
  });
  // Pass 2: legacy named entities written without a trailing ';' (e.g. "&micro"),
  // which HTML — and Python's html.parser — still decode, leaving trailing text.
  out = out.replace(LEGACY_RE, (_m, name: string) => NAMED[name] ?? _m);
  return out;
}
