import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { hydrate, sentence, tokens } from './data.mjs';

const read = (name) => JSON.parse(readFileSync(new URL(`../dist/${name}`, import.meta.url), 'utf8'));

test('the slim site data rebuilds the published data file exactly', () => {
  assert.deepEqual(hydrate(read('site-data.json')), read('cantonlink-community.json'));
});

test('full data passes through hydrate unchanged', () => {
  const full = read('cantonlink-community.json');
  assert.equal(hydrate(full), full);
});

test('sentences join punctuation and keep English words in code-mixed phrases', () => {
  const words = [['我', 'ngo5'], ['寫緊', 'se2 gan2'], ['code', 'code'], ['。']];
  assert.deepEqual(sentence(words, 'I am writing code.'), {
    cjk: '我寫緊code。', jyutping: 'ngo5 se2 gan2 code.', yale: 'ngóh sé gán code.', bopomofo: sentence(words).bopomofo, en: 'I am writing code.',
  });
  assert.deepEqual(tokens([['。']]), [{ cjk: '。', punctuation: '.' }]);
});
