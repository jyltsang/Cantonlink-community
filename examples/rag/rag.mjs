// Building blocks for a retrieval index over the CantonLink library: chunks,
// vectors, search, hybrid ranking and evaluation. No dependencies: the
// embedder is passed in, so the same code runs with a real model (embed.mjs)
// or with a stand-in in the tests.
//
// An embedder is { model, embed(texts) => Promise<number[][]> }.

import { createHash } from 'node:crypto';
import { searchWords, suggestPatterns } from '../../tools/library.mjs';

// Text with characters inside it, read in Jyutping. Chunks never contain
// characters: the embedding model is English, and nothing the index returns
// can then show characters to a learner who has turned them off.
const read = (text, parts) => (parts ? parts.map((p, i) => (typeof p === 'string' ? p : `${typeof parts[i - 1] === 'object' ? ' ' : ''}${p.jyutping}`)).join('') : text);

// One chunk per word, per grammar pattern and per example sentence. `text` is
// what gets embedded; the other fields are metadata kept beside the vector.
export function chunkLibrary(data) {
  const chunks = [];
  const meta = { source: 'cantonlink', licence: data.licence };
  for (const t of data.vocabulary) {
    for (const w of t.words) {
      chunks.push({
        id: `word:${t.id}/${w.jyutping}`, kind: 'word', topic: t.id, jyutping: w.jyutping, yale: w.yale, en: w.en, review: t.review.status, ...meta,
        text: [w.en, w.note && read(w.note, w.noteParts), `Topic: ${t.title}`].filter(Boolean).join('. '),
      });
    }
  }
  for (const p of data.grammar) {
    chunks.push({
      id: `pattern:${p.id}`, kind: 'pattern', pattern: p.id, jyutping: p.patternRomanised.jyutping, yale: p.patternRomanised.yale, en: p.meaning, review: p.review.status, ...meta,
      text: `Grammar: ${p.meaning}. ${p.functionName}. ${read(p.explanation, p.explanationParts)}`,
    });
    p.examples.forEach((ex, i) => chunks.push({
      id: `example:${p.id}:${i}`, kind: 'example', pattern: p.id, jyutping: ex.jyutping, yale: ex.yale, en: ex.en, review: p.review.status, ...meta,
      text: `${ex.en} (example of: ${p.meaning})`,
    }));
  }
  return chunks;
}

// Identifies the library a vector index was built from, so a stale index is
// noticed instead of quietly returning out-of-date entries.
export const dataVersion = (data) => createHash('sha256').update(JSON.stringify(data)).digest('hex').slice(0, 16);

export async function buildIndex(data, embedder, { batch = 32 } = {}) {
  const chunks = chunkLibrary(data);
  const vectors = [];
  for (let i = 0; i < chunks.length; i += batch) vectors.push(...await embedder.embed(chunks.slice(i, i + batch).map((c) => c.text)));
  return {
    model: embedder.model, dimensions: vectors[0].length, dataVersion: dataVersion(data), licence: data.licence, source: data.source,
    chunks: chunks.map((c, i) => ({ ...c, vector: vectors[i] })),
  };
}

export function checkIndex(index, data, embedder) {
  if (index.model !== embedder.model) throw new Error(`The index was built with ${index.model}, not ${embedder.model}. Vectors from different models cannot be compared: rebuild the index.`);
  if (index.dataVersion !== dataVersion(data)) throw new Error('The library has changed since the index was built: rebuild the index.');
}

export function cosine(a, b) {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na * nb) || 1);
}

// Brute force: with under a thousand chunks this takes well under a
// millisecond, so no vector database is needed to search the library itself.
export async function vectorSearch(index, embedder, query, limit = 10) {
  const [q] = await embedder.embed([query]);
  return index.chunks.map((c) => ({ id: c.id, score: cosine(q, c.vector) })).sort((a, b) => b.score - a.score).slice(0, limit);
}

// The library's own search: romanisation-aware for words (no tones, Yale,
// l for n…), plus grammar pattern suggestions. Embeddings are poor at this.
export function keywordSearch(data, query, limit = 10) {
  const words = searchWords(data, query, limit).map((r) => ({ id: `word:${r.word.topic}/${r.word.jyutping}`, score: r.score, approx: r.approx }));
  const patterns = suggestPatterns(data, query, limit).map((p) => ({ id: `pattern:${p.id}`, score: 0, approx: false }));
  return [...words, ...patterns].slice(0, limit);
}

// Reciprocal rank fusion: combines ranked lists without comparing their
// scores, which are on different scales.
export function fuse(lists, limit = 10, k = 60) {
  const scores = new Map();
  for (const list of lists) list.forEach((r, rank) => scores.set(r.id, (scores.get(r.id) ?? 0) + 1 / (k + rank + 1)));
  return [...scores].map(([id, score]) => ({ id, score })).sort((a, b) => b.score - a.score).slice(0, limit);
}

export async function hybridSearch(data, index, embedder, query, limit = 10) {
  return fuse([keywordSearch(data, query, limit * 2), await vectorSearch(index, embedder, query, limit * 2)], limit);
}

// Recall@k: the share of queries with an expected entry in the top k.
// MRR: the mean of 1/rank of the first expected entry (0 when missing).
export async function evaluate(cases, search, k = 5) {
  const rows = [];
  for (const c of cases) {
    const ids = (await search(c.query)).slice(0, k).map((r) => r.id);
    const at = ids.findIndex((id) => c.expect.includes(id));
    rows.push({ query: c.query, rank: at === -1 ? null : at + 1 });
  }
  return {
    recall: rows.filter((r) => r.rank).length / rows.length,
    mrr: rows.reduce((sum, r) => sum + (r.rank ? 1 / r.rank : 0), 0) / rows.length,
    rows,
  };
}
