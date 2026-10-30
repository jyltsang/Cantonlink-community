// A local embedding model through transformers.js. It runs on your own
// machine, needs no API key and costs nothing. The default model (about 23 MB,
// English, 384 dimensions) downloads from Hugging Face the first time and is
// then cached. Set CANTONLINK_EMBED_MODEL to try another feature-extraction
// model, then rebuild the index.

export const DEFAULT_MODEL = 'Xenova/all-MiniLM-L6-v2';

export async function createEmbedder(model = process.env.CANTONLINK_EMBED_MODEL || DEFAULT_MODEL) {
  const { pipeline } = await import('@huggingface/transformers');
  const extract = await pipeline('feature-extraction', model);
  return {
    model,
    embed: async (texts) => (await extract(texts, { pooling: 'mean', normalize: true })).tolist(),
  };
}
