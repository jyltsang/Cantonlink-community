# Build your own vector database for CantonLink

This guide is for developers who want to put the CantonLink Community library into a vector database: to ground their own AI tutor, to search by meaning ("I'm starving" finding the word for hungry), or to experiment with retrieval-augmented generation (RAG). It explains the decisions, the rules any index must keep, and how to measure whether it actually helps. A small runnable example is in [`examples/rag/`](../examples/rag/README.md).

**You will learn:**
- whether you need a vector database at all, and how to find out;
- how to chunk the library, what to embed and what metadata to keep;
- how to choose an embedding model and where to store the vectors;
- why the best results come from combining vectors with the library's own search;
- how to evaluate, so the decision rests on numbers;
- the project rules your index must keep: characters off, draft labels, licences and keys.

**You need:** Node.js 22 or later, and about 100 MB of disk space for the example's dependencies and model. No API key.

---

## 1. Do you need a vector database?

Start with the size of the library: 63 grammar patterns, 238 example sentences and 390 words, about 690 chunks in all. A vector "database" for that is a JSON file and a loop: comparing a query with every chunk takes well under a millisecond. You need a real vector store only when you add much more data, for example an external dictionary of tens of thousands of entries (see section 9).

The project's own MCP server uses **no embeddings**. Its search is romanisation-aware: tones are optional, Yale works with or without marks, syllables can run together, and l for n is accepted. That handles what learners without characters type, and embedding models handle it badly.

Where embeddings help is **meaning**. Keyword search cannot connect "I'm starving" to *ngo6* (hungry), or "where's the loo" to *sai2 sau2 gaan1* (toilet). On the example's 25 evaluation queries, keyword search alone finds the right entry in the top five for 16% (4 of 25): all four romanisation queries and only one plain English query, "goodbye". It misses every paraphrase. That gap is what an index should close, and section 7 shows how to measure whether it does.

## 2. Rules any index must keep

These are the project's standing rules, applied to retrieval. An index that breaks them teaches learners mistakes, or breaks the licence.

| Rule | What it means for your index |
|---|---|
| **Characters off by default, shown nowhere when off** | Embed English and romanisation, not characters. When showing results to a learner who has characters off, use the library's formatters with `{ characters: false }` (see section 6). |
| **Jyutping is the source of truth** | Take Jyutping and Yale from the data. Never let a model generate or "correct" romanisation; Yale is always generated from Jyutping. |
| **Draft until reviewed** | Keep each entry's `review.status` as metadata and show "draft" next to unreviewed results. Never mark anything reviewed. |
| **Licence: CC BY-SA 4.0** | The content is CC BY-SA 4.0 and the project treats an index derived from it as an adaptation: share it under CC BY-SA 4.0 with attribution to CantonLink Community and a link to the repository. |
| **External data stays separate** | If you add another dictionary, tag every entry with its source and licence, label it "external, unreviewed", and never mix it into the library's own results unlabelled (section 9). |
| **Keys are the learner's own** | If you use a paid embedding API, the key belongs to whoever runs the code. Never store or log it, and never ship it in an index. |

## 3. Get the data

Use the published data file rather than `content/`:

- [`dist/cantonlink-community.json`](../dist/cantonlink-community.json): grammar, vocabulary, the learning path and practice items, with Jyutping, Yale and Bopomofo already generated.
- [`dist/schema.json`](../dist/schema.json): its JSON Schema.

Fields ending in `Parts` (`explanationParts`, `noteParts`) are the same text with every character given as a word with its readings. They let you show an explanation such as "Add 咗 after a verb" as "Add zo2 after a verb".

## 4. Chunk the library

One chunk per thing a learner might look for:

| Chunk | Id | Embedded text | Metadata |
|---|---|---|---|
| Word | `word:{topic}/{jyutping}` | English meaning, usage note in Jyutping, topic title | topic, Jyutping, Yale, English, review status, source, licence |
| Grammar pattern | `pattern:{id}` | Meaning, function, explanation in Jyutping | pattern id, romanised pattern, review status |
| Example sentence | `example:{pattern}:{n}` | English sentence and the pattern's meaning | pattern id, Jyutping, Yale, English, review status |

Three choices matter here:

1. **Embed English, not characters.** Most small embedding models are English. Characters would add noise, and they would leak into results for learners who have them off.
2. **Keep the romanisation out of the meaning text, or keep it short.** An English model sees `ngo5 sik6 zo2` as nonsense tokens. Romanisation is matched by the keyword search instead (section 6).
3. **Keep stable ids.** Results should point back to library entries, so the AI or the website can fetch the full entry, with its examples and draft label, rather than trusting the chunk text.

See `chunkLibrary()` in [`examples/rag/rag.mjs`](../examples/rag/rag.mjs).

## 5. Choose a model and a store

**Embedding model.** The example uses `Xenova/all-MiniLM-L6-v2` through [transformers.js](https://huggingface.co/docs/transformers.js): about 23 MB, 384 dimensions, runs locally, no key, no cost. Other options:

| Option | When to choose it | Cost and keys |
|---|---|---|
| Small local English model (the example) | Learners search in English; you want zero cost and offline use | Free; one-off download |
| Local multilingual model | Learners also search in Chinese characters | Free; larger download |
| Hosted embedding API | You already use a provider and want its quality | Paid per token; the user's own key, never stored |

Whatever you choose, record the model name in the index. Vectors from different models cannot be compared, and the example refuses to search an index built with another model.

**Store.** For the library alone, a JSON file and brute-force cosine similarity are enough and the simplest to inspect. Move to a vector store (an embedded one such as SQLite with a vector extension or LanceDB, or a server such as PostgreSQL with pgvector) only when you have tens of thousands of chunks, or need filtering and updates you would otherwise write yourself. Keep the same ids and metadata whichever store you use.

## 6. Search: combine vectors with the library's own search

Neither search wins alone. Vectors find meaning ("I'm starving"); the library's search finds spelling ("lei hou", "sihk", "m goi"). The example combines them with **reciprocal rank fusion**: each list contributes `1 / (60 + rank)` to an entry's score, so results agree without their scores having to be on the same scale.

```js
import { keywordSearch, vectorSearch, fuse } from './rag.mjs';

const keyword = keywordSearch(data, query);                    // romanisation-aware
const vector = await vectorSearch(index, embedder, query);     // by meaning
const results = fuse([keyword, vector]);                       // reciprocal rank fusion
```

To show a result, look up the entry by its id and format it with the library's own functions, for example `formatWord(word, { characters: false, romanisation: 'yale' })`. That way the learner sees the reviewed Jyutping and Yale, the draft label and the right display, never raw chunk text.

To ground an AI, pass the formatted entries to the model with an instruction to use only them and to say when the answer is not in the library. The [MCP server](MCP_GUIDE.md) does the same through tools; a vector search could be added there as one more tool.

## 7. Evaluate before you decide

An index is worth keeping only if it finds more of what learners ask for. The example's [`eval-cases.json`](../examples/rag/eval-cases.json) has 25 queries, each with the entries that answer it:

- **paraphrases** ("where's the loo", "my laptop froze"), where embeddings should help;
- **romanisation** ("lei hou", "sihk", "m goi"), where keyword search should win;
- **grammar by meaning** ("comparing two things").

`npm run evaluate` reports two numbers for keyword, vector and hybrid search:

- **Recall@5:** the share of queries with a right entry in the top five.
- **MRR** (mean reciprocal rank): 1 for a right entry ranked first, 0.5 for second, and so on, averaged; 0 when missing.

The keyword baseline is 16% recall@5. **Decision rule:** adopt the hybrid only if it beats keyword search clearly on paraphrases *and* loses nothing on romanisation. Report the model, the library version and the date with any number you publish, and call it "agreement with the evaluation cases", not "accuracy".

Grow the cases whenever a search misses something it should find. More cases make the numbers more trustworthy than any change of model.

## 8. Keep the index fresh

The library changes as entries are written and reviewed. The example stores a hash of the data file in the index (`dataVersion`) and refuses to search a stale index. Rebuild after every library update; with a local model, embedding all 690 chunks takes seconds.

## 9. Adding external dictionaries

A larger vocabulary is where a real vector store starts to pay. Before adding any source:

1. **Check its licence.** It must allow redistribution and be compatible with CC BY-SA 4.0. Record the licence, version and URL. Exclude any source whose licence is unknown, as the project already does for some imported dictionaries.
2. **Tag every entry** with `source`, `licence` and the status "external, unreviewed".
3. **Keep the readings honest.** Use the source's Jyutping only if it gives Cantonese readings; never convert Mandarin pinyin. Check readings against the library and an independent dictionary where they overlap.
4. **Rank and label separately.** Show library entries first, and mark external ones clearly, so a learner always knows what has been reviewed.

The [master plan](MASTER_PLAN.md#licensing) keeps the list of sources and their licence decisions; propose a new source there, through an issue.

## 10. Run the example

```sh
cd examples/rag
npm ci
npm run build-index
npm run query -- "I'm starving"
npm run query -- "lei hou" --yale
npm run evaluate
```

`npm test` checks the chunking, the index metadata, the stale-index guard, fusion and the evaluation maths with a stand-in embedder, so it needs no model. The repository's CI runs it on every push. The real model needs network access to Hugging Face the first time; the project's CI does not download it, so vector and hybrid scores are not yet measured there. Share your results in an issue.

## Checklist

- [ ] One chunk per word, pattern and example, with stable ids pointing back to the library
- [ ] Embedded text in English and romanisation, no characters
- [ ] Review status, source and licence kept as metadata; drafts labelled in results
- [ ] Model name and library version stored; a stale or mismatched index refused
- [ ] Hybrid search: vectors for meaning, the library's search for romanisation
- [ ] Results shown through the library's formatters, respecting characters-off
- [ ] Evaluated against keyword search, with the numbers, model and date published
- [ ] Licence: CC BY-SA 4.0 with attribution; external sources tagged and labelled
- [ ] No API key stored, logged or shipped
