// Readings for English text with Cantonese characters inside it, such as
// "Add 咗 straight after a verb". Learners who turn characters off see the
// words in romanisation instead, so every character needs a reading the
// library can stand behind.

import { parseSyllable, toYale, toBopomofo } from './romanise.mjs';

const HAN_RUN = /\p{Script=Han}+/gu;
const MAX_WORD = 6;

// Splits text into plain strings and [characters, Jyutping] pairs.
//   lexicon   Map of library words to their reading (first reading wins)
//   readings  Map of single characters to every reading the library uses
//   overrides list of { cjk, jyutping, in? } checked readings; "in" limits one
//             to a single entry, without it the reading applies everywhere
//   fallback  (characters) => Jyutping, for characters the library lacks
//   where     the entry being read, for overrides and error messages
//   problems  receives a message for each single character that has several
//             readings in the library and no override saying which is meant
export function proseParts(text, { lexicon, readings, overrides = [], fallback, where = '', used = new Set(), problems = [] }) {
  const parts = [];
  let last = 0;
  const push = (part) => {
    if (typeof part === 'string' && typeof parts.at(-1) === 'string') parts[parts.length - 1] += part;
    else if (part !== '') parts.push(part);
  };
  const forHere = overrides.filter((o) => !o.in || o.in === where).sort((a, b) => b.cjk.length - a.cjk.length || Number(Boolean(b.in)) - Number(Boolean(a.in)));
  for (const match of text.matchAll(HAN_RUN)) {
    push(text.slice(last, match.index));
    last = match.index + match[0].length;
    const run = match[0];
    let i = 0;
    while (i < run.length) {
      const override = forHere.find((o) => run.startsWith(o.cjk, i));
      if (override) {
        used.add(override);
        push([override.cjk, override.jyutping]);
        i += override.cjk.length;
        continue;
      }
      let len = Math.min(MAX_WORD, run.length - i);
      while (len > 1 && !lexicon.has(run.slice(i, i + len))) len--;
      const cjk = run.slice(i, i + len);
      if (len > 1) push([cjk, lexicon.get(cjk)]);
      else {
        const known = [...(readings.get(cjk) ?? [])];
        if (known.length > 1) problems.push(`${where}: "${cjk}" in "${text}" has several readings in the library (${known.join(', ')}); add the right one to content/prose-readings.json`);
        push([cjk, known[0] ?? fallback(cjk)]);
      }
      i += len;
    }
  }
  push(text.slice(last));
  return parts;
}

export const joinParts = (parts) => parts.map((p) => (typeof p === 'string' ? p : p[0])).join('');

// Converts the Jyutping syllables in mixed text ("Verb + zo2") to Yale or
// Bopomofo, leaving the English as it is.
const SYLLABLE = /\b([a-z]+[1-6])\b/g;
export const romaniseMixed = (text, convert) => text.replace(SYLLABLE, (s) => (parseSyllable(s) ? convert(s) : s));
export const mixedRomanised = (jyutping) => ({ jyutping, yale: romaniseMixed(jyutping, toYale), bopomofo: romaniseMixed(jyutping, toBopomofo) });

// Checks that a pattern's Jyutping ("Verb + zo2 + … mei6?") lines up with its
// characters ("Verb + 咗 + … 未？"): one valid syllable per character, run by run.
export function patternMismatch(pattern, jyutping) {
  const runs = pattern.match(HAN_RUN) ?? [];
  const syllables = jyutping.match(SYLLABLE) ?? [];
  const chars = runs.join('').length;
  if (syllables.length !== chars) return `${chars} characters but ${syllables.length} Jyutping syllables`;
  const invalid = syllables.filter((s) => !parseSyllable(s));
  if (invalid.length) return `invalid Jyutping ${invalid.join(', ')}`;
  return null;
}
