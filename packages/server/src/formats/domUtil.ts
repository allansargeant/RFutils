/**
 * Thin helpers mapping the handful of Python ElementTree operations the
 * ported parsers use onto @xmldom/xmldom's W3C DOM.
 *
 *   ET .findtext(tag)  -> childText(el, tag)     (first *direct child*)
 *   ET .find(tag)      -> findChild(el, tag)
 *   ET .find("a/b")    -> findPath(el, "a/b")
 *   ET .iter(tag)      -> iterDescendants(el, tag) (descendants, excl. self)
 */

import { DOMParser } from '@xmldom/xmldom';

// xmldom's types are loose across versions; treat nodes structurally.
type El = any;

export function parseXml(text: string): El {
  const doc = new DOMParser({
    // Stay quiet on the malformed-but-parseable vendor exports.
    onError: () => {},
  } as any).parseFromString(text, 'text/xml');
  return doc.documentElement;
}

function elementChildren(el: El): El[] {
  const out: El[] = [];
  const nodes = el?.childNodes;
  if (!nodes) return out;
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    if (n && n.nodeType === 1) out.push(n);
  }
  return out;
}

export function findChild(el: El, tag: string): El | null {
  for (const child of elementChildren(el)) {
    if (child.tagName === tag) return child;
  }
  return null;
}

export function findPath(el: El, path: string): El | null {
  let current: El | null = el;
  for (const part of path.split('/')) {
    if (!current) return null;
    current = findChild(current, part);
  }
  return current;
}

export function childText(el: El, tag: string): string | null {
  const child = findChild(el, tag);
  if (!child) return null;
  const text = child.textContent;
  return text == null ? null : text;
}

export function findChildren(el: El, tag: string): El[] {
  return elementChildren(el).filter((c) => c.tagName === tag);
}

export function iterDescendants(el: El, tag: string): El[] {
  const found = el?.getElementsByTagName?.(tag);
  if (!found) return [];
  const out: El[] = [];
  for (let i = 0; i < found.length; i++) out.push(found[i]);
  return out;
}

export function attr(el: El, name: string): string | null {
  const v = el?.getAttribute?.(name);
  return v == null ? null : v;
}

export function tagName(el: El): string | null {
  return el?.tagName ?? null;
}
