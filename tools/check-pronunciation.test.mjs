import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { compare, check } from './check-pronunciation.mjs';

const notes = JSON.parse(readFileSync(new URL('../content/pronunciation-notes.json', import.meta.url), 'utf8')).notes;

test('readings that match the reference dictionary pass, in context', () => {
  assert.deepEqual(compare([['我', 'ngo5'], ['食咗', 'sik6 zo2'], ['飯', 'faan6'], ['。']]), []);
});

test('a wrong tone is reported with the reference reading', () => {
  assert.deepEqual(compare([['我', 'ngo5'], ['食咗', 'sik6 zo3'], ['飯', 'faan6']]), [{ cjk: '食咗', ours: 'sik6 zo3', reference: 'sik6 zo2' }]);
});

test('English words in code-mixed phrases are left out', () => {
  assert.deepEqual(compare([['寫', 'se2'], ['code', 'code']]), []);
});

test('all content agrees with the reference or has a documented reason', () => {
  const result = check(notes);
  assert.deepEqual(result.problems, []);
  assert.ok(result.checked > 700);
});

test('an undocumented difference and a stale note both fail', () => {
  const withoutCo5 = notes.filter((n) => n.cjk !== '坐');
  assert.ok(check(withoutCo5).problems.some((p) => p.includes('坐 is "co5"')));
  const stale = [...notes, { cjk: '飯', jyutping: 'faan2', reference: 'faan6', reason: 'test' }];
  assert.ok(check(stale).problems.some((p) => p.includes('no longer matches')));
});
