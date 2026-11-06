import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { crc32 } from 'node:zlib';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { updatePins, fetchAll, readLicenceText, sha256File, loadSources } from './fetch.mjs';

const sha = (buf) => createHash('sha256').update(buf).digest('hex');

// A minimal stored (uncompressed) zip with one member, so tests need no zip tool.
function storedZip(name, content) {
  const n = Buffer.from(name);
  const data = Buffer.from(content);
  const crc = crc32(data);
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt32LE(crc, 14);
  local.writeUInt32LE(data.length, 18);
  local.writeUInt32LE(data.length, 22);
  local.writeUInt16LE(n.length, 26);
  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(20, 4);
  central.writeUInt16LE(20, 6);
  central.writeUInt32LE(crc, 16);
  central.writeUInt32LE(data.length, 20);
  central.writeUInt32LE(data.length, 24);
  central.writeUInt16LE(n.length, 28);
  const localPart = Buffer.concat([local, n, data]);
  const centralPart = Buffer.concat([central, n]);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(1, 8);
  end.writeUInt16LE(1, 10);
  end.writeUInt32LE(centralPart.length, 12);
  end.writeUInt32LE(localPart.length, 16);
  return Buffer.concat([localPart, centralPart, end]);
}

const SA3 = '# Distributed under a Creative Commons Attribution-Share Alike 3.0 license (http://creativecommons.org/licenses/by-sa/3.0/)\n';
const SA4 = '# License:\n# Creative Commons Attribution-ShareAlike 4.0 International License\n# https://creativecommons.org/licenses/by-sa/4.0/\n';

// Builds a cache with downloads served from memory, so no test touches the network.
function setup(files, sources) {
  const dir = mkdtempSync(join(tmpdir(), 'dict-fetch-'));
  const cacheDir = join(dir, 'cache');
  const served = {};
  for (const s of sources) served[s.url] = files[s.id];
  const download = async (url, dest) => writeFileSync(dest, served[url]);
  return { dir, cacheDir, download };
}

const textSource = (body, over = {}) => ({
  id: 'canto', name: 'CC-Canto', url: 'https://example.test/canto.txt', file: 'canto.txt', version: 'test',
  sha256: sha(Buffer.from(body)),
  licence: { expected: 'CC BY-SA 3.0', patterns: ['creativecommons\\.org/licenses/by-sa/3\\.0/'], from: { kind: 'text', maxLines: 20 } },
  ...over,
});

test('all good: right checksum and right licence passes', async () => {
  const body = `# CC-Canto\n${SA3}hello\tworld\n`;
  const src = textSource(body);
  const { cacheDir, download } = setup({ canto: body }, [src]);
  const res = await fetchAll([src], { cacheDir, download });
  assert.equal(res.ok, true);
  assert.equal(res.results[0].licence.status, 'verified');
  assert.match(readFileSync(join(cacheDir, 'canto', 'LICENCE.txt'), 'utf8'), /by-sa\/3\.0/);
});

test('a wrong checksum fails and the bad file is not trusted', async () => {
  const body = `# CC-Canto\n${SA3}`;
  const src = textSource(body, { sha256: 'a'.repeat(64) });
  const { cacheDir, download } = setup({ canto: body }, [src]);
  const res = await fetchAll([src], { cacheDir, download });
  assert.equal(res.ok, false);
  assert.equal(res.results[0].checksum.ok, false);
  assert.equal(res.results[0].checksum.actual, sha(Buffer.from(body)));
  assert.equal(res.results[0].licence.status, 'skipped');
});

test('a licence that differs from the expected one fails', async () => {
  const body = '# CC-Canto\n# Distributed under a Creative Commons Attribution-Share Alike 4.0 license (http://creativecommons.org/licenses/by-sa/4.0/)\n';
  const src = textSource(body);
  const { cacheDir, download } = setup({ canto: body }, [src]);
  const res = await fetchAll([src], { cacheDir, download });
  assert.equal(res.ok, false);
  assert.equal(res.results[0].checksum.ok, true);
  assert.equal(res.results[0].licence.status, 'mismatch');
  assert.match(res.results[0].licence.found, /4\.0/);
});

test('the licence is read from inside a zip', async () => {
  const zip = storedZip('cedict_ts.u8', `# CC-CEDICT\n${SA4}1 1 [x] /y/\n`);
  const src = {
    id: 'cedict', name: 'CC-CEDICT', url: 'https://example.test/c.zip', file: 'c.zip', version: 'test', sha256: sha(zip),
    licence: { expected: 'CC BY-SA 4.0', patterns: ['creativecommons\\.org/licenses/by-sa/4\\.0/'], from: { kind: 'zip', member: 'cedict_ts.u8', maxLines: 20 } },
  };
  const { cacheDir, download } = setup({ cedict: zip }, [src]);
  const res = await fetchAll([src], { cacheDir, download });
  assert.equal(res.results[0].licence.status, 'verified');
  assert.equal(res.ok, true);
});

test('the licence is read from inside a tar.gz', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'dict-tar-'));
  mkdirSync(join(dir, 'pkg'));
  writeFileSync(join(dir, 'pkg', 'LICENSE.txt'), 'Creative Commons Attribution 4.0 International Public License\n\nBy exercising...\n');
  execFileSync('tar', ['-czf', join(dir, 'p.tar.gz'), '-C', dir, 'pkg']);
  const tgz = readFileSync(join(dir, 'p.tar.gz'));
  const src = {
    id: 'hk', name: 'HKCanCor', url: 'https://example.test/p.tar.gz', file: 'p.tar.gz', version: 'test', sha256: sha(tgz),
    licence: { expected: 'CC BY 4.0', patterns: ['Creative Commons Attribution 4\\.0 International Public License'], from: { kind: 'tar', member: 'pkg/LICENSE.txt', maxLines: 20 } },
  };
  const { cacheDir, download } = setup({ hk: tgz }, [src]);
  const res = await fetchAll([src], { cacheDir, download });
  assert.equal(res.results[0].licence.status, 'verified');
  rmSync(dir, { recursive: true });
});

test('a licence that cannot be read from the download is reported as unverified, and strict mode fails it', async () => {
  const body = '1\tyue\t sentence\n';
  const src = textSource(body, {
    id: 'tat', file: 'tat.tsv', licence: { expected: 'CC BY 2.0 FR', unverified: 'The export carries no licence text.' },
  });
  const { cacheDir, download } = setup({ tat: body }, [src]);
  const loose = await fetchAll([src], { cacheDir, download });
  assert.equal(loose.ok, true);
  assert.equal(loose.results[0].licence.status, 'unverified');
  const strict = await fetchAll([src], { cacheDir, download, strict: true });
  assert.equal(strict.ok, false);
});

test('a source marked pending is skipped without downloading', async () => {
  const src = { id: 'p', name: 'Pending', status: 'pending', note: 'No reachable source.' };
  let called = false;
  const res = await fetchAll([src], { cacheDir: join(tmpdir(), 'unused-dict'), download: async () => { called = true; } });
  assert.equal(called, false);
  assert.equal(res.ok, true);
  assert.equal(res.results[0].status, 'pending');
  assert.equal((await fetchAll([src], { cacheDir: join(tmpdir(), 'unused-dict'), download: async () => {}, strict: true })).ok, false);
});

test('a cached file with the right checksum is not downloaded again', async () => {
  const body = `# CC-Canto\n${SA3}`;
  const src = textSource(body);
  const { cacheDir, download } = setup({ canto: body }, [src]);
  await fetchAll([src], { cacheDir, download });
  let calls = 0;
  const res = await fetchAll([src], { cacheDir, download: async () => { calls++; } });
  assert.equal(calls, 0);
  assert.equal(res.ok, true);
});

test('readLicenceText and sha256File work on plain files', () => {
  const dir = mkdtempSync(join(tmpdir(), 'dict-read-'));
  const file = join(dir, 'a.txt');
  writeFileSync(file, 'one\ntwo\nthree\n');
  assert.equal(sha256File(file), sha(Buffer.from('one\ntwo\nthree\n')));
  assert.equal(readLicenceText(file, { kind: 'text', maxLines: 2 }), 'one\ntwo');
  assert.equal(existsSync(file), true);
});

test('the real sources.json is well formed', () => {
  const sources = loadSources();
  const ids = sources.map((s) => s.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const s of sources) {
    if (s.status === 'pending') { assert.ok(s.note, `${s.id} pending needs a note`); continue; }
    assert.match(s.sha256, /^[0-9a-f]{64}$/, s.id);
    assert.match(s.url, /^https:\/\//, s.id);
    assert.ok(s.file && s.version && s.licence.expected, s.id);
    assert.ok(s.licence.unverified || (s.licence.patterns?.length && s.licence.from?.kind), `${s.id} needs a licence check`);
  }
});

test('updatePins rewrites only the changed checksum in sources.json', async () => {
  const body = `# CC-Canto\n${SA3}old\n`;
  const src = textSource(body);
  const fresh = `# CC-Canto\n${SA3}new\n`;
  const { dir, cacheDir, download } = setup({ canto: fresh }, [src]);
  const path = join(dir, 'sources.json');
  writeFileSync(path, JSON.stringify({ sources: [src] }, null, 2));
  assert.deepEqual(await updatePins([src], { path, cacheDir, download }), ['canto']);
  const [pinned] = JSON.parse(readFileSync(path, 'utf8')).sources;
  assert.equal(pinned.sha256, sha(Buffer.from(fresh)));
  assert.equal(pinned.url, src.url);
  assert.deepEqual(await updatePins([pinned], { path, cacheDir, download }), []);
});

test('updatePins refuses to guess when a pinned hash appears more than once', async () => {
  const body = `# CC-Canto\n${SA3}old\n`;
  const src = textSource(body);
  const { dir, cacheDir, download } = setup({ canto: `${body}changed` }, [src]);
  const path = join(dir, 'sources.json');
  writeFileSync(path, JSON.stringify({ sources: [src, { ...src, id: 'twin' }] }, null, 2));
  await assert.rejects(updatePins([src], { path, cacheDir, download }), /exactly one pin/);
});
