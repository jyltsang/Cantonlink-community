import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Readable, Writable } from 'node:stream';
import { main, wordCommand } from '../cli.mjs';
import { loadLibrary } from '../shared.mjs';

function run(args, stdin = '') {
  let out = '';
  let err = '';
  const sink = (append) => new Writable({ write(chunk, _enc, done) { append(String(chunk)); done(); } });
  const io = { input: Readable.from([stdin]), out: sink((s) => { out += s; }), err: sink((s) => { err += s; }) };
  return main(args, io).then((code) => ({ code, out, err }));
}

test('help and version', async () => {
  assert.match((await run([])).out, /cantonlink word \[query\]/);
  assert.match((await run(['--version'])).out, /^\d+\.\d+\.\d+/);
});

test('word looks words up, and gives a stable word of the day', async () => {
  const { code, out } = await run(['word', 'deadline']);
  assert.equal(code, 0);
  assert.match(out, /趕 deadline — gon2 deadline \| Yale: gón deadline/);
  assert.equal((await run(['word', 'zzzz'])).code, 1);
  const data = loadLibrary();
  const capture = (date) => { let s = ''; wordCommand(data, '', { out: { write: (t) => { s += t; } }, c: { bold: (t) => t }, today: date }); return s; };
  assert.equal(capture(new Date('2026-10-23T08:00:00Z')), capture(new Date('2026-10-23T20:00:00Z')));
  assert.notEqual(capture(new Date('2026-10-23T08:00:00Z')), capture(new Date('2026-10-24T08:00:00Z')));
});

test('romanise converts Jyutping and explains invalid input', async () => {
  assert.match((await run(['romanise', 'gwong2', 'dung1', 'waa2'])).out, /Bopomofo/);
  const bad = await run(['romanise', 'nei hou']);
  assert.equal(bad.code, 1);
  assert.match(bad.err, /tone number/);
});

test('quiz asks questions, marks answers and stops on an empty line', async () => {
  const { code, out } = await run(['quiz', '--level', 'B1', '--count', '3', '--system', 'yale'], '1\n2\n\n');
  assert.equal(code, 0);
  assert.match(out, /Fill the gap · B1 · 3 questions/);
  assert.equal(out.match(/^ {2}(Correct|Not quite)\./gm).length, 2);
  assert.match(out, /Score: \d \/ 2/);
});

test('bad options are rejected with a clear message', async () => {
  assert.match((await run(['quiz', '--level', 'C2'])).err, /--level must be one of A1, A2, B1/);
  assert.match((await run(['quiz', '--count', '0'])).err, /--count/);
  assert.equal((await run(['dance'])).code, 2);
});
