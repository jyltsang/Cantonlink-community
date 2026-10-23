// Formats content/*.json so that short structures (a sentence's word list,
// a gap, a review block) stay on one line. That keeps diffs readable for
// reviewers, who mostly compare whole sentences.

import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const INLINE_LIMIT = 240;
const CHECK = process.argv.includes('--check');

function compact(value) {
  if (Array.isArray(value)) return `[${value.map(compact).join(', ')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value).map(([k, v]) => `${JSON.stringify(k)}: ${compact(v)}`);
    return entries.length ? `{ ${entries.join(', ')} }` : '{}';
  }
  return JSON.stringify(value);
}

export function format(value, indent = '') {
  const flat = compact(value);
  if (typeof value !== 'object' || value === null || indent.length + flat.length <= INLINE_LIMIT) return flat;
  const inner = indent + '  ';
  if (Array.isArray(value)) return `[\n${value.map((v) => inner + format(v, inner)).join(',\n')}\n${indent}]`;
  const entries = Object.entries(value).map(([k, v]) => `${inner}${JSON.stringify(k)}: ${format(v, inner)}`);
  return `{\n${entries.join(',\n')}\n${indent}}`;
}

function jsonFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return jsonFiles(path);
    return name.endsWith('.json') ? [path] : [];
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const unformatted = [];
  for (const path of jsonFiles(join(ROOT, 'content'))) {
    const text = readFileSync(path, 'utf8');
    const formatted = format(JSON.parse(text)) + '\n';
    if (text === formatted) continue;
    if (CHECK) unformatted.push(path.slice(ROOT.length + 1));
    else writeFileSync(path, formatted);
  }
  if (unformatted.length) {
    console.error(`✗ Content is not formatted. Run \`npm run format\`.\n  ${unformatted.join('\n  ')}`);
    process.exit(1);
  }
  console.log(CHECK ? '✓ Content is formatted' : '✓ Formatted content');
}
