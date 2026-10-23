import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { z } from 'zod';

const read = (name) => JSON.parse(readFileSync(new URL(`../../dist/${name}`, import.meta.url), 'utf8'));
const schema = z.fromJSONSchema(read('schema.json'));

test('the published data file matches dist/schema.json', () => {
  const result = schema.safeParse(read('cantonlink-community.json'));
  assert.ok(result.success, JSON.stringify(result.error?.issues.slice(0, 3)));
});

test('the schema rejects malformed entries', () => {
  const data = read('cantonlink-community.json');
  data.grammar[0].level = 'C2';
  delete data.vocabulary[0].words[0].yale;
  data.practice.fillGap[0].options.pop();
  const paths = schema.safeParse(data).error.issues.map((i) => i.path.join('.'));
  assert.ok(paths.includes('grammar.0.level'));
  assert.ok(paths.some((p) => p.startsWith('vocabulary.0.words.0')));
  assert.ok(paths.includes('practice.fillGap.0.options'));
});
