// The checking pipeline every AI reply passes before a learner relies on it.
// Checks 2–7 are deterministic and use the same rules as the library build,
// so AI output is held to the same standard as the reviewed content.

import { parseSyllable, toYale, toBopomofo } from './romanise.mjs';
import { checkSpoken, checkWordAlignment, findPattern } from './library.mjs';

export const CHECKS = [
  { id: 'structure', label: 'Structure', running: 'Reading the reply…' },
  { id: 'jyutping', label: 'Valid Jyutping', running: 'Checking Jyutping…' },
  { id: 'alignment', label: 'Characters match syllables', running: 'Matching characters to syllables…' },
  { id: 'spoken', label: 'Spoken, not written, Chinese', running: 'Looking for written Chinese…' },
  { id: 'library', label: 'Agrees with the library', running: 'Comparing with the library…' },
  { id: 'patterns', label: 'Grammar references are real', running: 'Checking grammar references…' },
  { id: 'romanisation', label: 'Yale and Bopomofo generated locally', running: 'Generating Yale and Bopomofo…' },
  { id: 'opinion', label: 'Second opinion', running: 'Asking for a second opinion…' },
];
const BLOCKING = new Set(['structure', 'jyutping', 'alignment', 'spoken']);

// --- Reply formats (JSON Schema, also usable as structured-output schemas) --

const WORD = {
  type: 'object',
  additionalProperties: false,
  required: ['cjk', 'jyutping'],
  properties: {
    cjk: { type: 'string', description: 'One word in Hong Kong Traditional characters, or one punctuation mark' },
    jyutping: { type: 'string', description: 'Jyutping with tone numbers, one syllable per character; empty for punctuation' },
  },
};
const SENTENCE = {
  type: 'object',
  additionalProperties: false,
  required: ['words', 'en'],
  properties: { words: { type: 'array', items: WORD }, en: { type: 'string' } },
};

export const SCHEMAS = {
  tutor: {
    type: 'object',
    additionalProperties: false,
    required: ['reply', 'correction', 'patterns', 'note'],
    properties: {
      reply: SENTENCE,
      correction: {
        anyOf: [
          { type: 'null' },
          {
            type: 'object',
            additionalProperties: false,
            required: ['learner_said', 'better', 'explanation', 'pattern_id'],
            properties: {
              learner_said: { type: 'string' },
              better: SENTENCE,
              explanation: { type: 'string' },
              pattern_id: { anyOf: [{ type: 'string' }, { type: 'null' }] },
            },
          },
        ],
      },
      patterns: { type: 'array', items: { type: 'string' } },
      note: { type: 'string' },
    },
  },
  sentence: SENTENCE,
  explain: {
    type: 'object',
    additionalProperties: false,
    required: ['explanation', 'examples'],
    properties: { explanation: { type: 'string' }, examples: { type: 'array', items: SENTENCE } },
  },
};

// --- Parsing --------------------------------------------------------------

export function parseReply(text) {
  if (typeof text !== 'string' || !text.trim()) return { error: 'The reply was empty.' };
  const unfenced = text.replace(/^\s*```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '');
  const start = unfenced.indexOf('{');
  const end = unfenced.lastIndexOf('}');
  if (start === -1 || end <= start) return { error: 'The reply was not JSON.' };
  try {
    return { value: JSON.parse(unfenced.slice(start, end + 1)) };
  } catch {
    return { error: 'The reply was not valid JSON.' };
  }
}

const isSentence = (s) => s && typeof s === 'object' && Array.isArray(s.words) && typeof s.en === 'string'
  && s.words.every((w) => w && typeof w.cjk === 'string' && typeof w.jyutping === 'string');

function shapeErrors(kind, v) {
  if (!v || typeof v !== 'object') return ['The reply is not an object.'];
  if (kind === 'sentence') return isSentence(v) ? [] : ['Expected {"words": [...], "en": "..."}.'];
  if (kind === 'explain') {
    const errors = [];
    if (typeof v.explanation !== 'string') errors.push('"explanation" must be text.');
    if (!Array.isArray(v.examples) || !v.examples.every(isSentence)) errors.push('"examples" must be a list of sentences.');
    return errors;
  }
  const errors = [];
  if (!isSentence(v.reply)) errors.push('"reply" must be a sentence with "words" and "en".');
  if (v.correction != null && !(isSentence(v.correction.better) && typeof v.correction.explanation === 'string')) errors.push('"correction" must be null or include "better" and "explanation".');
  if (v.patterns != null && !Array.isArray(v.patterns)) errors.push('"patterns" must be a list.');
  return errors;
}

function sentencesOf(kind, v) {
  if (kind === 'sentence') return [v];
  if (kind === 'explain') return v.examples;
  return [v.reply, v.correction?.better].filter(Boolean);
}

// --- Per-word helpers -----------------------------------------------------

const PUNCTUATION = { '。': '.', '，': ',', '？': '?', '！': '!', '、': ',', '：': ':', '；': ';', '…': '…', '「': '"', '」': '"' };
const isPunctuation = (cjk) => !/[\p{Script=Han}A-Za-z0-9]/u.test(cjk);
const convert = (jyutping, fn) => jyutping.split(/\s+/).filter(Boolean).map((s) => (parseSyllable(s) ? fn(s) : s)).join(' ');

// --- The pipeline ---------------------------------------------------------

export function verify(kind, text, { data, lexicon }) {
  const steps = Object.fromEntries(CHECKS.map((c) => [c.id, { id: c.id, label: c.label, status: 'pending', detail: '' }]));
  const set = (id, status, detail = '') => Object.assign(steps[id], { status, detail });
  const finish = () => {
    const list = CHECKS.map((c) => steps[c.id]);
    const failed = list.filter((s) => s.status === 'fail' && BLOCKING.has(s.id));
    return { steps: list, failed: failed.length > 0, retryFeedback: failed.length ? failed.map((s) => `${s.label}: ${s.detail}`).join(' ') : null };
  };

  // 1. Structure
  const parsed = parseReply(text);
  const errors = parsed.error ? [parsed.error] : shapeErrors(kind, parsed.value);
  if (errors.length) {
    set('structure', 'fail', errors.join(' '));
    for (const c of CHECKS.slice(1)) set(c.id, 'skip', 'Not run: the reply could not be read.');
    return { ...finish(), value: null };
  }
  set('structure', 'pass', 'The reply has the expected format.');
  const value = structuredClone(parsed.value);
  const sentences = sentencesOf(kind, value);
  const words = sentences.flatMap((s) => s.words).filter((w) => !isPunctuation(w.cjk));
  for (const w of words) w.jyutping = w.jyutping.trim().toLowerCase().replace(/\s+/g, ' ');

  // 2. Valid Jyutping and 3. Alignment
  const invalid = [];
  const misaligned = [];
  for (const w of words) {
    const result = checkWordAlignment(w.cjk, w.jyutping);
    invalid.push(...result.invalid.map((s) => `"${s}" in ${w.cjk}`));
    if (!result.invalid.length && result.han !== result.syllables) misaligned.push(`${w.cjk} has ${result.han} character${result.han === 1 ? '' : 's'} but ${result.syllables} syllable${result.syllables === 1 ? '' : 's'}`);
  }
  if (invalid.length) set('jyutping', 'fail', `Not valid Jyutping: ${invalid.join(', ')}. Each syllable needs a tone number from 1 to 6.`);
  else set('jyutping', 'pass', `All ${words.reduce((n, w) => n + w.jyutping.split(' ').length, 0)} syllables are valid Jyutping.`);
  if (misaligned.length) set('alignment', 'fail', misaligned.join('; ') + '.');
  else set('alignment', invalid.length ? 'skip' : 'pass', invalid.length ? 'Not run until the Jyutping is valid.' : 'Every word has one syllable per character.');

  // 4. Spoken, not written, Chinese
  const findings = sentences.flatMap((s) => checkSpoken(s.words.map((w) => w.cjk).join('')));
  if (findings.length) set('spoken', 'fail', `Written-Chinese forms: ${findings.map((f) => `"${f.written}" (say ${f.spoken})`).join(', ')}.`);
  else set('spoken', 'pass', 'No written-Chinese forms found.');

  // 5. Agrees with the library. Multi-character words have one reading, so a
  // mismatch is corrected; single characters can have several, so it is noted.
  const fixed = [];
  const noted = [];
  let known = 0;
  // A model may split a library word across tokens (開 + 會 for 開會); when
  // the joined tokens match the word's reading, they count as that word.
  const covered = new Set();
  for (let i = 0; i < words.length; i++) {
    for (let n = Math.min(4, words.length - i); n >= 2; n--) {
      const run = words.slice(i, i + n);
      if (run.some((w) => !w.jyutping)) continue;
      const readings = lexicon.get(run.map((w) => w.cjk).join(''));
      if (readings?.has(run.map((w) => w.jyutping).join(' '))) {
        run.forEach((_, k) => covered.add(i + k));
        known++;
        break;
      }
    }
  }
  for (const [index, w] of words.entries()) {
    if (covered.has(index)) continue;
    const readings = lexicon.get(w.cjk);
    if (!readings) continue;
    known++;
    if (readings.has(w.jyutping)) continue;
    const [libraryReading] = readings;
    if ([...w.cjk].length >= 2) {
      fixed.push(`${w.cjk}: ${w.jyutping} → ${libraryReading}`);
      w.jyutping = libraryReading;
      w.corrected = true;
    } else {
      noted.push(`${w.cjk} is ${[...readings].join(' or ')} in the library, not ${w.jyutping}`);
    }
  }
  if (fixed.length) set('library', 'fixed', `Corrected to the library's reading: ${fixed.join('; ')}.${noted.length ? ` Note: ${noted.join('; ')}.` : ''}`);
  else if (noted.length) set('library', 'warn', `Check: ${noted.join('; ')}. A character can have more than one reading.`);
  else set('library', 'pass', known ? `${known} of ${words.length} words are in the library, and all match it.` : 'None of these words are in the library yet, so the other rules apply.');

  // 6. Grammar references
  if (kind === 'tutor') {
    const cited = [...(value.patterns ?? []), value.correction?.pattern_id].filter(Boolean);
    const unknown = cited.filter((id) => !findPattern(data, id));
    value.patterns = (value.patterns ?? []).filter((id) => findPattern(data, id));
    if (value.correction && value.correction.pattern_id && !findPattern(data, value.correction.pattern_id)) value.correction.pattern_id = null;
    if (unknown.length) set('patterns', 'fixed', `Removed references to patterns that do not exist: ${unknown.join(', ')}.`);
    else set('patterns', 'pass', cited.length ? `Cites ${cited.length} real pattern${cited.length === 1 ? '' : 's'}: ${[...new Set(cited)].join(', ')}.` : 'No grammar patterns cited.');
  } else {
    set('patterns', 'skip', 'Not applicable.');
  }

  // 7. Romanisation is always generated here, never taken from the AI
  for (const s of sentences) {
    s.tokens = s.words.map((w) => (isPunctuation(w.cjk)
      ? { cjk: w.cjk, punctuation: PUNCTUATION[w.cjk] ?? w.cjk }
      : { cjk: w.cjk, jyutping: w.jyutping, yale: convert(w.jyutping, toYale), bopomofo: convert(w.jyutping, toBopomofo), corrected: Boolean(w.corrected) }));
    s.cjk = s.words.map((w) => w.cjk).join('');
    s.jyutping = s.tokens.map((t) => t.punctuation ?? t.jyutping).join(' ').replace(/ ([.,?!:;])/g, '$1');
  }
  set('romanisation', 'pass', 'Yale and Bopomofo were generated from the Jyutping by this site.');
  set('opinion', 'skip', 'Off. Turn it on in AI settings.');

  return { ...finish(), value };
}

export function badgeFor(result, { retried = false } = {}) {
  if (result.failed) return 'unverified';
  if (retried || result.steps.some((s) => s.status === 'fixed')) return 'corrected';
  return 'verified';
}

// Local checks on what the learner typed, before it goes to the tutor.
export function checkLearnerText(text) {
  const notes = [];
  if (/\p{Script=Han}/u.test(text)) {
    for (const f of checkSpoken(text)) notes.push(`"${f.written}" is written Chinese; in speech say ${f.spoken}.`);
  }
  const tokens = text.toLowerCase().match(/\b[a-z]+[0-9]\b/g) ?? [];
  const bad = tokens.filter((t) => !parseSyllable(t));
  if (bad.length) notes.push(`Not valid Jyutping: ${bad.join(', ')}.`);
  return notes;
}
