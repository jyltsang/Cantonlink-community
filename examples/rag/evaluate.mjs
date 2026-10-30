// Compares keyword, vector and hybrid search on eval-cases.json, so the
// decision to use embeddings rests on numbers, not on expectation.
//   npm run evaluate

import { readFileSync } from 'node:fs';
import { checkIndex, keywordSearch, vectorSearch, hybridSearch, evaluate } from './rag.mjs';
import { createEmbedder } from './embed.mjs';
import { loadData, loadIndex } from './shared.mjs';

const K = 5;
const cases = JSON.parse(readFileSync(new URL('./eval-cases.json', import.meta.url), 'utf8')).cases;
const data = loadData();
const index = loadIndex();
const embedder = await createEmbedder(index.model);
checkIndex(index, data, embedder);

const methods = {
  keyword: async (q) => keywordSearch(data, q, K),
  vector: (q) => vectorSearch(index, embedder, q, K),
  hybrid: (q) => hybridSearch(data, index, embedder, q, K),
};
const results = {};
for (const [name, search] of Object.entries(methods)) results[name] = await evaluate(cases, search, K);

console.log(`${cases.length} queries, model ${index.model}, library ${index.dataVersion}\n`);
console.log(`| Method | Recall@${K} | MRR |\n|---|---|---|`);
for (const [name, r] of Object.entries(results)) console.log(`| ${name} | ${(r.recall * 100).toFixed(0)}% | ${r.mrr.toFixed(2)} |`);
console.log(`\n| Query | ${Object.keys(methods).join(' | ')} |\n|---|${Object.keys(methods).map(() => '---').join('|')}|`);
cases.forEach((c, i) => console.log(`| ${c.query} | ${Object.values(results).map((r) => r.rows[i].rank ?? '-').join(' | ')} |`));
console.log('\nNumbers are ranks of the first expected entry (- means not in the top results).');
