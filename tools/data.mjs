// Builds the published data structures from compact word lists. Words are written compactly as [characters, Jyutping], or [mark] for
// punctuation; Yale and Bopomofo are always generated from the Jyutping.

import { phraseToYale, phraseToBopomofo } from './romanise.mjs';

export const PUNCTUATION = { '。': '.', '，': ',', '？': '?', '！': '!', '、': ',' };

const SYSTEMS = { jyutping: (j) => j, yale: phraseToYale, bopomofo: phraseToBopomofo };
const romanOf = (words, convert) => words
  .map((w) => (w.length === 1 ? PUNCTUATION[w[0]] : convert(w[1])))
  .join(' ')
  .replace(/ ([.,?!])/g, '$1');

export const word = (cjk, jyutping) => ({ cjk, jyutping, yale: phraseToYale(jyutping), bopomofo: phraseToBopomofo(jyutping) });
export const tokens = (words) => words.map((w) => (w.length === 1 ? { cjk: w[0], punctuation: PUNCTUATION[w[0]] } : word(w[0], w[1])));
const parts = (list) => list.map((part) => (typeof part === 'string' ? part : word(...part)));
const withParts = (item, name) => (item[name] ? { ...item, [name]: parts(item[name]) } : item);

export const sentence = (words, en) => ({
  cjk: words.map((w) => w[0]).join(''),
  jyutping: romanOf(words, SYSTEMS.jyutping),
  yale: romanOf(words, SYSTEMS.yale),
  bopomofo: romanOf(words, SYSTEMS.bopomofo),
  ...(en ? { en } : {}),
});

// --- Site data ------------------------------------------------------------

// The website loads a slim copy of the data file (dist/site-data.json): words
// as [characters, Jyutping], each example sentence once, and practice items as
// references to examples. hydrate() rebuilds the full published structure, so
// the site works with exactly the same data as everyone else.
export function hydrate(data) {
  if (!data.slim) return data;
  const { licence, source, grammar, vocabulary, path, practice } = data;
  const examples = new Map();
  const full = {
    licence, source,
    grammar: grammar.map((p) => ({
      ...withParts(p, 'explanationParts'),
      examples: p.examples.map(([words, en], i) => {
        const ex = { ...sentence(words, en), tokens: tokens(words) };
        examples.set(`${p.id}:${i}`, { p, ex });
        return ex;
      }),
      mistakes: p.mistakes.map((m) => ({ ...withParts(m, 'noteParts'), correct: sentence(m.correct) })),
    })),
    vocabulary: vocabulary.map((t) => ({
      ...withParts(t, 'noteParts'),
      titleWord: word(...t.titleWord),
      words: t.words.map(({ classifier, ...w }) => ({ ...word(w.cjk, w.jyutping), ...withParts(w, 'noteParts'), ...(classifier ? { classifier: word(...classifier) } : {}) })),
    })),
    path: path.map((u) => ({
      ...u,
      titleWord: word(...u.titleWord),
      dialogue: { ...u.dialogue, lines: u.dialogue.lines.map(([speaker, words, en]) => ({ speaker, ...sentence(words, en), tokens: tokens(words) })) },
    })),
    practice: {
      fillGap: practice.fillGap.map(([id, gapIndex, options]) => {
        const { p, ex } = examples.get(id);
        return { id, patternId: p.id, level: p.level, en: ex.en, tokens: ex.tokens, gapIndex, options: options.map((o) => word(...o)) };
      }),
      buildSentence: practice.buildSentence.map((entry) => {
        const [id, accept] = Array.isArray(entry) ? entry : [entry];
        const { p, ex } = examples.get(id);
        return { id, patternId: p.id, level: p.level, en: ex.en, tokens: ex.tokens, ...(accept ? { accept } : {}) };
      }),
      spokenOrWritten: {
        review: practice.spokenOrWritten.review,
        items: practice.spokenOrWritten.items.map(({ spoken: [words, en], ...item }) => ({ ...item, spoken: sentence(words, en) })),
      },
    },
  };
  return full;
}
