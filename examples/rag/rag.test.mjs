// Tests the example without downloading a model: a stand-in embedder hashes
// words into a small vector, which is enough to check the plumbing.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { chunkLibrary, buildIndex, checkIndex, vectorSearch, keywordSearch, fuse, hybridSearch, evaluate, cosine } from './rag.mjs';

const data = JSON.parse(readFileSync(new URL('../../dist/cantonlink-community.json', import.meta.url), 'utf8'));
const cases = JSON.parse(readFileSync(new URL('./eval-cases.json', import.meta.url), 'utf8')).cases;

function standIn(model = 'stand-in') {
  const vector = (text) => {
    const v = new Array(64).fill(0);
    for (const word of text.toLowerCase().match(/[a-z]+/g) ?? []) {
      let h = 0;
      for (const ch of word) h = (h * 31 + ch.charCodeAt(0)) % 64;
      v[h] += 1;
    }
    return v;
  };
  return { model, embed: async (texts) => texts.map(vector) };
}

test('chunks cover the whole library, with unique ids, metadata and no characters', () => {
  const chunks = chunkLibrary(data);
  const words = data.vocabulary.reduce((n, t) => n + t.words.length, 0);
  const examples = data.grammar.reduce((n, p) => n + p.examples.length, 0);
  assert.equal(chunks.length, words + data.grammar.length + examples);
  assert.equal(new Set(chunks.map((c) => c.id)).size, chunks.length, 'ids are unique');
  for (const c of chunks) {
    assert.doesNotMatch(c.text, /\p{Script=Han}/u, c.id);
    assert.ok(c.text.length > 3 && c.review && c.licence && c.source === 'cantonlink', c.id);
  }
});

test('every expected entry in the evaluation cases exists', () => {
  const ids = new Set(chunkLibrary(data).map((c) => c.id));
  for (const c of cases) for (const id of c.expect) assert.ok(ids.has(id), `${c.query}: ${id}`);
  assert.ok(cases.every((c) => !/\p{Script=Han}/u.test(c.query)), 'queries are typed by learners without characters');
});

test('an index records its model and library version, and refuses a mismatch', async () => {
  const embedder = standIn();
  const index = await buildIndex(data, embedder);
  assert.equal(index.model, 'stand-in');
  assert.equal(index.dimensions, 64);
  assert.equal(index.licence, data.licence);
  assert.doesNotThrow(() => checkIndex(index, data, embedder));
  assert.throws(() => checkIndex(index, data, standIn('other')), /cannot be compared/);
  const changed = structuredClone(data);
  changed.vocabulary[0].words[0].en = 'changed';
  assert.throws(() => checkIndex(index, changed, embedder), /changed since the index was built/);
});

test('vector, keyword and hybrid search each return ranked library ids', async () => {
  const embedder = standIn();
  const index = await buildIndex(data, embedder);
  assert.equal((await vectorSearch(index, embedder, 'pay by card', 3))[0].id, 'word:shopping/luk1 kaat1');
  assert.equal(keywordSearch(data, 'lei hou')[0].id, 'word:greetings/nei5 hou2');
  const hybrid = await hybridSearch(data, index, embedder, 'lei hou', 5);
  assert.ok(hybrid.some((r) => r.id === 'word:greetings/nei5 hou2'), 'keyword results survive fusion');
  assert.equal(cosine([1, 0], [1, 0]), 1);
  assert.equal(cosine([1, 0], [0, 1]), 0);
});

test('fusion rewards agreement between lists', () => {
  const fused = fuse([[{ id: 'a' }, { id: 'b' }], [{ id: 'b' }, { id: 'c' }]]);
  assert.equal(fused[0].id, 'b');
  assert.deepEqual(fused.map((r) => r.id).sort(), ['a', 'b', 'c']);
});

test('evaluation reports recall and MRR', async () => {
  const search = async (q) => (q === 'one' ? [{ id: 'x' }, { id: 'y' }] : [{ id: 'z' }]);
  const r = await evaluate([{ query: 'one', expect: ['y'] }, { query: 'two', expect: ['y'] }], search, 5);
  assert.equal(r.recall, 0.5);
  assert.equal(r.mrr, 0.25);
  assert.deepEqual(r.rows.map((x) => x.rank), [2, null]);
});
