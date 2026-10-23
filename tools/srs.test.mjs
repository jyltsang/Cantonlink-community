import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BOX_DAYS, schedule, migrate, dueKeys, nextDue, endOfDay } from './srs.mjs';

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 9, 23, 12);

test('a miss goes into box 1, due at once', () => {
  assert.deepEqual(schedule(undefined, false, NOW), { box: 1, due: NOW });
  assert.deepEqual(schedule({ box: 4, due: NOW }, false, NOW), { box: 1, due: NOW });
});

test('a correct answer on an item that is not scheduled changes nothing', () => {
  assert.equal(schedule(undefined, true, NOW), null);
});

test('correct reviews climb the boxes with growing intervals, then graduate', () => {
  let entry = { box: 1, due: NOW };
  const gaps = [];
  while (entry) {
    const next = schedule(entry, true, NOW);
    if (next) gaps.push((next.due - NOW) / DAY);
    entry = next;
  }
  assert.deepEqual(gaps, BOX_DAYS.slice(1));
});

test('old timestamp saves are migrated to box 1', () => {
  assert.deepEqual(migrate({ a: 5, b: { box: 3, due: 9 } }), { a: { box: 1, due: 5 }, b: { box: 3, due: 9 } });
  assert.deepEqual(migrate(undefined), {});
});

test('only due items are offered, oldest first', () => {
  const items = { later: { box: 2, due: NOW + DAY }, old: { box: 1, due: NOW - 2 * DAY }, now: { box: 1, due: NOW } };
  assert.deepEqual(dueKeys(items, NOW), ['old', 'now']);
  assert.equal(nextDue(items, NOW), NOW + DAY);
  assert.equal(nextDue({}, NOW), null);
  assert.ok(endOfDay(NOW) >= NOW && endOfDay(NOW) - NOW < DAY);
});
