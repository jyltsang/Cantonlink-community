// Downloads the dictionary source files into data/dictionary/.cache/ (ignored by git),
// checks each against the SHA-256 pinned in data/dictionary/sources.json, and reads
// each source's own licence text, failing when it differs from the expected licence.
//
// Cache layout (the build in a later task reads from here):
//   data/dictionary/.cache/<id>/<file>         the download, exactly as published
//   data/dictionary/.cache/<id>/LICENCE.txt    the licence text read from that download
//
// Usage: node tools/dictionary/fetch.mjs [--strict] [--cache <dir>]
//   --strict   also fail for sources whose licence cannot be read from the download
//              ("unverified") and for sources marked "pending".

import { createHash } from 'node:crypto';
import { execFile, execFileSync } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdirSync, readFileSync, writeFileSync, existsSync, renameSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
export const SOURCES_PATH = join(HERE, '..', '..', 'data', 'dictionary', 'sources.json');
export const CACHE_DIR = join(HERE, '..', '..', 'data', 'dictionary', '.cache');
const MAX_BUFFER = 256 * 1024 * 1024;

export function loadSources(path = SOURCES_PATH) {
  return JSON.parse(readFileSync(path, 'utf8')).sources;
}

export function sha256File(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

const firstLines = (text, maxLines) => text.split(/\r?\n/).slice(0, maxLines).join('\n');

// Reads the licence text from a downloaded file. `from.kind` is "text" (the file's own
// header), "zip" or "tar" (a named member of the archive). Only the first `maxLines`
// lines are used, which is where every one of these sources states its licence.
export function readLicenceText(file, from) {
  const maxLines = from.maxLines ?? 40;
  let raw;
  if (from.kind === 'text') raw = readFileSync(file, 'utf8');
  else if (from.kind === 'zip') raw = execFileSync('unzip', ['-p', file, from.member], { maxBuffer: MAX_BUFFER }).toString('utf8');
  else if (from.kind === 'tar') raw = execFileSync('tar', ['-xzOf', file, from.member], { maxBuffer: MAX_BUFFER }).toString('utf8');
  else throw new Error(`Unknown licence source kind: ${from.kind}`);
  return firstLines(raw, maxLines);
}

const run = promisify(execFile);

// curl follows redirects and honours the proxy and CA settings of the environment.
export async function curlDownload(url, dest) {
  await run('curl', ['--fail', '--silent', '--show-error', '--location', '--output', dest, url], { maxBuffer: MAX_BUFFER });
}

function checkLicence(source, file, dir) {
  const { licence } = source;
  if (licence.unverified) return { status: 'unverified', expected: licence.expected, reason: licence.unverified };
  const text = readLicenceText(file, licence.from);
  writeFileSync(join(dir, 'LICENCE.txt'), `${text}\n`);
  const missing = licence.patterns.filter((p) => !new RegExp(p, 'i').test(text));
  if (missing.length) return { status: 'mismatch', expected: licence.expected, missing, found: text };
  return { status: 'verified', expected: licence.expected };
}

async function fetchOne(source, { cacheDir, download }) {
  if (source.status === 'pending') return { id: source.id, status: 'pending', note: source.note };
  const dir = join(cacheDir, source.id);
  const file = join(dir, source.file);
  mkdirSync(dir, { recursive: true });
  if (!existsSync(file) || sha256File(file) !== source.sha256) {
    const part = `${file}.part`;
    await download(source.url, part);
    renameSync(part, file);
  }
  const actual = sha256File(file);
  if (actual !== source.sha256) {
    return { id: source.id, checksum: { ok: false, expected: source.sha256, actual }, licence: { status: 'skipped' } };
  }
  return { id: source.id, checksum: { ok: true, actual }, licence: checkLicence(source, file, dir) };
}

export async function fetchAll(sources, { cacheDir = CACHE_DIR, download = curlDownload, strict = false } = {}) {
  const results = [];
  for (const source of sources) results.push(await fetchOne(source, { cacheDir, download }));
  const ok = results.every((r) => {
    if (r.status === 'pending') return !strict;
    if (!r.checksum.ok) return false;
    if (r.licence.status === 'unverified') return !strict;
    return r.licence.status === 'verified';
  });
  return { ok, results };
}

function report({ results }) {
  for (const r of results) {
    if (r.status === 'pending') console.log(`PENDING   ${r.id}: ${r.note}`);
    else if (!r.checksum.ok) console.log(`CHECKSUM  ${r.id}: expected ${r.checksum.expected}, got ${r.checksum.actual}`);
    else if (r.licence.status === 'verified') console.log(`OK        ${r.id}: checksum and licence (${r.licence.expected})`);
    else if (r.licence.status === 'unverified') console.log(`UNVERIFIED ${r.id}: checksum ok; licence ${r.licence.expected} not readable from the download: ${r.licence.reason}`);
    else console.log(`LICENCE   ${r.id}: expected ${r.licence.expected}, missing ${r.licence.missing.join(', ')}\n${r.licence.found}`);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const cacheIndex = args.indexOf('--cache');
  const outcome = await fetchAll(loadSources(), {
    strict: args.includes('--strict'),
    cacheDir: cacheIndex >= 0 ? args[cacheIndex + 1] : CACHE_DIR,
  });
  report(outcome);
  process.exit(outcome.ok ? 0 : 1);
}
