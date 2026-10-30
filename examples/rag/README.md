# Build your own vector index (example)

A small, runnable example of retrieval over the CantonLink Community library: chunk the library, embed it with a local model, search it, combine the results with the library's own romanisation-aware search, and measure whether embeddings help.

It is not part of the website or the npm package. The full walkthrough, with the rules any index must keep, is the **[RAG guide](../../docs/RAG_GUIDE.md)**.

```sh
cd examples/rag
npm ci                                   # installs transformers.js
npm run build-index                      # downloads a ~23 MB model once, writes index.json
npm run query -- "I'm starving"          # keyword, vector and hybrid results
npm run query -- "lei hou" --yale
npm run evaluate                         # recall@5 and MRR for each method
npm test                                 # no model needed
```

No API key is used and nothing leaves your machine except the one-off model download from Hugging Face. `index.json` is derived from CC BY-SA 4.0 content: share it under the same licence, with attribution.
