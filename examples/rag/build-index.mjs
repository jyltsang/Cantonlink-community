// Embeds every chunk of the library and writes index.json beside this file.
//   npm run build-index

import { writeFileSync } from 'node:fs';
import { buildIndex } from './rag.mjs';
import { createEmbedder } from './embed.mjs';
import { INDEX, loadData } from './shared.mjs';

const embedder = await createEmbedder();
const started = Date.now();
const index = await buildIndex(loadData(), embedder);
writeFileSync(INDEX, JSON.stringify(index));
console.log(`Indexed ${index.chunks.length} chunks with ${index.model} (${index.dimensions} dimensions) in ${((Date.now() - started) / 1000).toFixed(1)} s.`);
console.log(`Library version ${index.dataVersion}. The index is derived from ${index.licence} content: share it under the same licence, with attribution.`);
