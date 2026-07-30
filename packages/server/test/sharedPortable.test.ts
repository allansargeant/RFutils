/**
 * `packages/shared` runs in the browser as well as on the server — that is what
 * makes the static build (GitHub Pages) possible. A Node builtin imported into
 * a parser would break the hosted app while every other test still passed,
 * because the tests themselves run under Node. So assert it directly.
 */

import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';

const SHARED_SRC = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'shared', 'src');

function tsFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return tsFiles(full);
    return full.endsWith('.ts') ? [full] : [];
  });
}

describe('shared stays browser-portable', () => {
  const files = tsFiles(SHARED_SRC);

  it('finds the shared sources', () => {
    expect(files.length).toBeGreaterThan(10);
  });

  const NODE_IMPORT = /(?:from|import)\s*\(?\s*'(node:[\w/.-]+|fs|fs\/promises|path|os|crypto|net|dgram|child_process|worker_threads)'/;

  it('imports no Node builtins', () => {
    const offenders = files.filter((f) => NODE_IMPORT.test(readFileSync(f, 'utf8')));
    expect(offenders.map((f) => relative(SHARED_SRC, f))).toEqual([]);
  });

  it('would catch a Node builtin if one were added', () => {
    expect(NODE_IMPORT.test("import { readFileSync } from 'node:fs';")).toBe(true);
    expect(NODE_IMPORT.test("const fs = await import('node:fs');")).toBe(true);
    expect(NODE_IMPORT.test("import { readFileSync } from 'fs';")).toBe(true);
    expect(NODE_IMPORT.test("import { parse } from './freqParse.js';")).toBe(false);
  });

  it('uses no Node globals', () => {
    const offenders = files.filter((f) => {
      const src = readFileSync(f, 'utf8');
      return /\bBuffer\s*\.|\bprocess\.env\b|\b__dirname\b/.test(src);
    });
    expect(offenders.map((f) => relative(SHARED_SRC, f))).toEqual([]);
  });
});
