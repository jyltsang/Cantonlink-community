// Searches the library three ways and prints what a learner would see, in
// romanisation only.
//   npm run query -- "I'm starving"
//   npm run query -- "lei hou" --yale

import { parseArgs } from 'node:util';
import { formatWord, formatPattern, findPattern } from '../../tools/library.mjs';
import { checkIndex, keywordSearch, vectorSearch, fuse } from './rag.mjs';
import { createEmbedder } from './embed.mjs';
import { loadData, loadIndex } from './shared.mjs';

const { values, positionals } = parseArgs({ allowPositionals: true, options: { yale: { type: 'boolean' }, limit: { type: 'string', default: '5' } } });
const query = positionals.join(' ').trim();
if (!query) {
  console.error('Give a query, e.g. npm run query -- "I\'m starving"');
  process.exit(2);
}
const limit = Number(values.limit);
const display = { characters: false, romanisation: values.yale ? 'yale' : 'jyutping' };

const data = loadData();
const index = loadIndex();
const embedder = await createEmbedder(index.model);
checkIndex(index, data, embedder);

const keyword = keywordSearch(data, query, limit * 2);
const vector = await vectorSearch(index, embedder, query, limit * 2);
const hybrid = fuse([keyword, vector], limit);

const byId = new Map(index.chunks.map((c) => [c.id, c]));
const words = new Map(data.vocabulary.flatMap((t) => t.words.map((w) => [`word:${t.id}/${w.jyutping}`, w])));
const show = (id) => {
  const chunk = byId.get(id);
  if (chunk.kind === 'word') return formatWord(words.get(id), display);
  if (chunk.kind === 'pattern') return formatPattern(findPattern(data, chunk.pattern), display).split('\n').slice(0, 3).join('\n');
  return `${chunk[display.romanisation]}\n  English: ${chunk.en}\n  (example of ${chunk.pattern})`;
};
const label = (id) => (byId.get(id).review === 'reviewed' ? '' : ' [draft, not yet reviewed]');

const top = (list) => list.slice(0, limit).map((r) => r.id).join(', ') || 'nothing';
console.log(`Keyword: ${top(keyword)}\nVector:  ${top(vector)}\n`);
console.log(`Hybrid, best first:\n`);
for (const r of hybrid) console.log(`${show(r.id)}${label(r.id)}\n`);
