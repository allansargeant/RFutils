#!/usr/bin/env node
/**
 * Inline the WWB .shw XML templates into a TypeScript module.
 *
 * The show generator used to read these with `readFileSync`, which tied it to
 * Node. The parsers themselves are environment-agnostic, and the browser build
 * (GitHub Pages) needs the generator too, so the templates are compiled into
 * the bundle instead of loaded from disk.
 *
 * The .tpl files remain the source of truth — they are verbatim fragments of a
 * real WWB7 show file and must never be edited to look "tidier". This script
 * copies their bytes into a TS string literal and nothing else: it escapes only
 * what a template literal requires (backslash, backtick, `${`), so the value at
 * runtime is byte-identical to the file on disk.
 */

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const templatesDir = join(root, 'src', 'pmse', 'templates');
const outFile = join(root, 'src', 'pmse', 'templates.generated.ts');

/** Map a template filename to its exported constant name. */
const EXPORTS = {
  'skeleton.xml.tpl': 'SKELETON',
  'device_ad4q_a.xml.tpl': 'DEVICE_TPL',
  'profile_ad4q_a.xml.tpl': 'PROFILE_TPL',
  'freq_entry_ad4q_a.xml.tpl': 'FREQ_ENTRY_TPL',
};

function escapeForTemplateLiteral(text) {
  return text.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${');
}

const present = new Set(readdirSync(templatesDir));
for (const name of Object.keys(EXPORTS)) {
  if (!present.has(name)) {
    console.error(`gen-templates: missing template ${name} in ${templatesDir}`);
    process.exit(1);
  }
}

let out = `/**
 * GENERATED FILE — do not edit. Run \`npm run gen:templates -w @rfutils/shared\`.
 * Source: src/pmse/templates/*.tpl (verbatim fragments of a real WWB7 show file).
 */

`;

for (const [file, constant] of Object.entries(EXPORTS)) {
  const text = readFileSync(join(templatesDir, file), 'utf-8');
  out += `/** ${file} */\nexport const ${constant} = \`${escapeForTemplateLiteral(text)}\`;\n\n`;
}

writeFileSync(outFile, out, 'utf-8');
console.log(`gen-templates: wrote ${outFile}`);
