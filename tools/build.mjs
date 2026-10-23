// Validates everything in content/ and generates the readable library/ pages
// and the dist/ data file. Run with --check to fail if generated files are stale.

import { readFileSync, writeFileSync, readdirSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseSyllable, phraseToYale, phraseToBopomofo, toYale, toBopomofo } from './romanise.mjs';
import { PUNCTUATION, word, tokens, sentence } from './data.mjs';
import { SCHEMA } from './schema.mjs';

// CANTONLINK_ROOT lets tests validate a modified copy of content/.
const ROOT = process.env.CANTONLINK_ROOT ?? join(dirname(fileURLToPath(import.meta.url)), '..');
const CHECK = process.argv.includes('--check');
const readJson = (path) => JSON.parse(readFileSync(join(ROOT, path), 'utf8'));
const listJson = (dir) => readdirSync(join(ROOT, dir)).filter((f) => f.endsWith('.json')).sort();

// --- Load -----------------------------------------------------------------

const LEVELS = ['A1', 'A2', 'B1'];
const patterns = LEVELS.flatMap((level) => readJson(`content/grammar/${level}.json`));
const topics = listJson('content/vocabulary').map((f) => readJson(`content/vocabulary/${f}`)).sort((a, b) => a.order - b.order);
const spokenOrWritten = readJson('content/practice/spoken-or-written.json');
const extraLexicon = readJson('content/lexicon.json');
const path = readJson('content/path.json');
const dialogues = readJson('content/dialogues.json').dialogues;

const FUNCTIONS = {
  'being-and-having': 'Being and having',
  negation: 'Negation',
  questions: 'Asking questions',
  aspect: 'Time and aspect',
  'possession-and-description': 'Possession and description',
  'location-and-pointing': 'Location and pointing',
  counting: 'Counting',
  'wants-and-needs': 'Wants, needs and ability',
  'degree-and-comparison': 'Degree and comparison',
  particles: 'Sentence-final particles',
  connecting: 'Connecting words',
  complements: 'Verb endings and complements',
  passive: 'Passive',
};

// --- Validate -------------------------------------------------------------

// Words that can stand in for each other, so one may never be offered as a
// wrong option when the other is the answer.
const EQUIVALENTS = [['乜嘢', '咩'], ['點', '點樣'], ['定係', '定'], ['而家', '依家'], ['畀', '俾']];

const errors = [];
const fail = (where, message) => errors.push(`${where}: ${message}`);
const HAN = /\p{Script=Han}/gu;

// English words in code-mixed phrases (寫 code) are written the same in the
// characters and the Jyutping, and are left out of the syllable count.
function checkJyutping(where, cjk, jyutping) {
  const english = cjk.match(/[A-Za-z][A-Za-z0-9'+.#-]*/g) ?? [];
  const tokens = jyutping.trim().split(/\s+/);
  if (english.join(' ') !== tokens.filter((t) => !/\d$/.test(t)).join(' ')) fail(where, `English words in "${cjk}" and "${jyutping}" do not match`);
  const syllables = tokens.filter((t) => /\d$/.test(t) || !english.includes(t));
  for (const s of syllables) if (!parseSyllable(s)) fail(where, `invalid Jyutping syllable "${s}" in "${jyutping}"`);
  const chars = cjk.match(HAN) ?? [];
  if (chars.length !== syllables.length) fail(where, `"${cjk}" has ${chars.length} characters but "${jyutping}" has ${syllables.length} syllables`);
}

function checkWords(where, words) {
  for (const word of words) {
    if (word.length === 1) {
      if (!(word[0] in PUNCTUATION)) fail(where, `"${word[0]}" has no Jyutping and is not punctuation`);
    } else {
      checkJyutping(where, word[0], word[1]);
    }
  }
}

// Tell-tale Standard Written Chinese. Whole words are checked exactly, so
// legitimate spoken words such as 的士 (taxi) or 小說 (novel) still pass.
const WRITTEN_WORDS = new Set(['是', '的', '不', '了', '在', '和', '跟', '給', '被', '吧', '說', '看', '那', '那裏', '這裏', '甚麼', '什麼', '沒有', '不要', '還是']);
const WRITTEN_CHARS = /[他她們這哪沒吃很喝]/u;
function checkSpoken(where, words) {
  for (const [cjk] of words) {
    if (WRITTEN_WORDS.has(cjk) || WRITTEN_CHARS.test(cjk)) fail(where, `"${cjk}" is written Chinese; use the spoken Cantonese form`);
  }
}

const lexicon = new Map();
const learn = (cjk, jyutping) => { if (!lexicon.has(cjk)) lexicon.set(cjk, jyutping); };

const ids = new Set();
for (const p of patterns) {
  if (ids.has(p.id)) fail(p.id, 'duplicate pattern id');
  ids.add(p.id);
  if (p.examples.length < 3) fail(p.id, 'needs at least three examples');
  if (!FUNCTIONS[p.function]) fail(p.id, `unknown function "${p.function}"`);
  p.examples.forEach((ex, i) => {
    const where = `${p.id} example ${i + 1}`;
    checkWords(where, ex.words);
    checkSpoken(where, ex.words);
    ex.words.filter((w) => w.length === 2).forEach(([c, j]) => learn(c, j));
    if (ex.gap) {
      if (!ex.words.some((w) => w[0] === ex.gap.word)) fail(where, `gap word "${ex.gap.word}" is not a word in the sentence`);
      const options = new Set([ex.gap.word, ...ex.gap.distractors]);
      if (ex.gap.distractors.length !== 3 || options.size !== 4) fail(where, 'gap needs three distinct distractors that differ from the answer');
      for (const d of ex.gap.distractors) {
        if (ex.words.some((w) => w[0] === d)) fail(where, `distractor "${d}" already appears in the sentence`);
        if (EQUIVALENTS.some((set) => set.includes(d) && set.includes(ex.gap.word))) fail(where, `distractor "${d}" means the same as the answer "${ex.gap.word}"`);
      }
    }
    if (ex.accept) {
      const own = ex.words.filter((w) => w.length === 2).map((w) => w[0]);
      const key = (list) => [...list].sort().join('|');
      const seen = new Set([own.join('|')]);
      for (const alt of ex.accept) {
        if (key(alt) !== key(own)) fail(where, `accepted order "${alt.join(' ')}" must use exactly the sentence's words`);
        if (seen.has(alt.join('|'))) fail(where, `accepted order "${alt.join(' ')}" repeats the sentence or another accepted order`);
        seen.add(alt.join('|'));
      }
    }
  });
  (p.mistakes ?? []).forEach((m, i) => {
    checkWords(`${p.id} mistake ${i + 1}`, m.correct);
    checkSpoken(`${p.id} mistake ${i + 1}`, m.correct);
  });
}
for (const p of patterns) for (const r of p.related ?? []) if (!ids.has(r)) fail(p.id, `related pattern "${r}" does not exist`);

const seenWords = new Map();
for (const t of topics) {
  t.words.forEach((w) => {
    if (seenWords.has(w.cjk)) fail(`${t.id}/${w.cjk}`, `already listed in ${seenWords.get(w.cjk)}`);
    seenWords.set(w.cjk, t.id);
    checkSpoken(`${t.id}/${w.cjk}`, [[w.cjk]]);
    checkJyutping(`${t.id}/${w.cjk}`, w.cjk, w.jyutping);
    learn(w.cjk, w.jyutping);
    if (w.classifier) {
      checkJyutping(`${t.id}/${w.cjk} classifier`, ...w.classifier);
      learn(...w.classifier);
    }
  });
}
spokenOrWritten.items.forEach((item, i) => {
  checkWords(`spoken-or-written ${i + 1}`, item.spoken);
  checkSpoken(`spoken-or-written ${i + 1}`, item.spoken);
});
for (const [cjk, jyutping] of extraLexicon.words) {
  checkJyutping(`lexicon/${cjk}`, cjk, jyutping);
  learn(cjk, jyutping);
}
for (const p of patterns) {
  p.examples.forEach((ex, i) => {
    for (const d of ex.gap?.distractors ?? []) if (!lexicon.has(d)) fail(`${p.id} example ${i + 1}`, `distractor "${d}" has no known Jyutping; add it to content/lexicon.json`);
  });
}

// The learning path must teach every pattern and topic exactly once, in
// order of level, using real ids and scenarios.
{
  const SCENARIOS = ['free', 'restaurant', 'shopping', 'transport', 'directions', 'doctor', 'work', 'friends'];
  const taught = new Map();
  const topicIds = new Set(topics.map((t) => t.id));
  const byId = new Map(patterns.map((p) => [p.id, p]));
  const unitIds = new Set();
  let lastLevel = 0;
  for (const u of path.units) {
    const where = `path/${u.id}`;
    if (unitIds.has(u.id)) fail(where, 'duplicate unit id');
    unitIds.add(u.id);
    if (!LEVELS.includes(u.level)) fail(where, `unknown level "${u.level}"`);
    if (LEVELS.indexOf(u.level) < lastLevel) fail(where, 'units must go up in level');
    lastLevel = Math.max(lastLevel, LEVELS.indexOf(u.level));
    if (!SCENARIOS.includes(u.scenario)) fail(where, `unknown tutor scenario "${u.scenario}"`);
    checkJyutping(`${where} title`, u.titleCjk, u.titleJyutping);
    for (const id of [...u.patterns, ...u.topics]) {
      if (!byId.has(id) && !topicIds.has(id)) fail(where, `"${id}" is not a pattern or topic id`);
      else if (taught.has(id)) fail(where, `"${id}" is already taught in ${taught.get(id)}`);
      taught.set(id, u.id);
      if (byId.has(id) && byId.get(id).level !== u.level) fail(where, `pattern "${id}" is ${byId.get(id).level}, but the unit is ${u.level}`);
    }
  }
  for (const id of [...byId.keys(), ...topicIds]) if (!taught.has(id)) fail('path', `"${id}" is not in any unit`);
}

// One model dialogue per unit, in natural spoken Cantonese, that uses at
// least three of the unit's patterns. A pattern counts as used when the
// characters of one of its forms (e.g. 有冇, or 一 + 就) all appear.
const patternForms = (p) => p.pattern.split('/').map((form) => (form.match(/\p{Script=Han}/gu) ?? []).join('')).filter(Boolean);
{
  const units = new Map(path.units.map((u) => [u.id, u]));
  const byId = new Map(patterns.map((p) => [p.id, p]));
  const seen = new Set();
  for (const d of dialogues) {
    const where = `dialogue/${d.unit}`;
    if (!units.has(d.unit)) { fail(where, 'unknown unit'); continue; }
    if (seen.has(d.unit)) fail(where, 'the unit already has a dialogue');
    seen.add(d.unit);
    if (!d.title?.trim()) fail(where, 'needs a title');
    if (!d.speakers?.A || !d.speakers?.B) fail(where, 'needs two named speakers, A and B');
    if (d.lines.length < 6 || d.lines.length > 8) fail(where, `has ${d.lines.length} lines; use 6 to 8`);
    d.lines.forEach((line, i) => {
      const at = `${where} line ${i + 1}`;
      if (!d.speakers?.[line.speaker]) fail(at, `unknown speaker "${line.speaker}"`);
      if (!line.en?.trim()) fail(at, 'needs an English translation');
      checkWords(at, line.words);
      checkSpoken(at, line.words);
      line.words.filter((w) => w.length === 2).forEach(([c, j]) => learn(c, j));
    });
    const text = d.lines.map((line) => line.words.map((w) => w[0]).join('')).join('');
    const used = units.get(d.unit).patterns.filter((id) => patternForms(byId.get(id)).some((form) => [...form].every((c) => text.includes(c))));
    if (used.length < 3) fail(where, `uses ${used.length} of the unit's patterns (${used.join(', ') || 'none'}); use at least three`);
  }
  for (const u of path.units) if (!seen.has(u.id)) fail(`path/${u.id}`, 'has no dialogue in content/dialogues.json');
}

const REVIEW_STATUSES = ['draft', 'reviewed'];
function checkReview(where, review) {
  if (!review || !REVIEW_STATUSES.includes(review.status)) return fail(where, `review.status must be one of ${REVIEW_STATUSES.join(', ')}`);
  const reviewers = new Set(review.reviewers ?? []);
  if (reviewers.size !== (review.reviewers ?? []).length) fail(where, 'review.reviewers contains duplicates');
  if (review.status === 'reviewed' && reviewers.size < 2) fail(where, 'status "reviewed" needs at least two named reviewers');
}
patterns.forEach((p) => checkReview(p.id, p.review));
topics.forEach((t) => checkReview(t.id, t.review));
checkReview('spoken-or-written', spokenOrWritten.review);

if (errors.length) {
  console.error(`✗ ${errors.length} content error(s):\n  ${errors.join('\n  ')}`);
  process.exit(1);
}

// --- Formatting helpers ---------------------------------------------------

const cjkOf = (words) => words.map((w) => w[0]).join('');
const SYSTEMS = { jyutping: (j) => j, yale: phraseToYale, bopomofo: phraseToBopomofo };
const option = (cjk) => { const w = word(cjk, lexicon.get(cjk)); return `${w.cjk} ${w.jyutping} · ${w.yale} · ${w.bopomofo}`; };

function sentenceTable(s) {
  return [
    '| | |', '|---|---|',
    `| 漢字 | **${s.cjk}** |`,
    `| Jyutping | ${s.jyutping} |`,
    `| Yale | ${s.yale} |`,
    `| Bopomofo | ${s.bopomofo} |`,
    `| English | ${s.en} |`,
  ].join('\n');
}

function seededRandom(seedText) {
  let h = 1779033703;
  for (const ch of seedText) h = Math.imul(h ^ ch.codePointAt(0), 3432918353);
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}
function shuffle(items, seedText) {
  const rand = seededRandom(seedText);
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const REPO = 'https://github.com/jyltsang/cantonlink-community';
const SITE = 'https://jyltsang.github.io/Cantonlink-community/';
const reportLink = (entry) => `${REPO}/issues/new?template=content-error.yml&title=${encodeURIComponent(`[Correction] ${entry}`)}`;
const listNames = (names) => (names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`);

function reviewNotice(review, entry) {
  if (review.status === 'reviewed') return `> **Reviewed** by ${listNames(review.reviewers)}. Spotted something unnatural? Please [report it](${reportLink(entry)}).`;
  const n = review.reviewers.length;
  const progress = n >= 2 ? ' (changed since review; needs re-checking)' : n ? ` (${n} of 2 reviews done)` : '';
  return `> **Draft: awaiting native-speaker review${progress}.** Spotted something unnatural? Please [report it](${reportLink(entry)}).`;
}

const reviewables = [
  ...patterns.map((p) => ({ kind: 'Grammar', id: p.id, name: p.pattern, level: p.level, review: p.review, page: `grammar/${p.id}.md` })),
  ...topics.map((t) => ({ kind: 'Vocabulary', id: t.id, name: t.title, level: '—', review: t.review, page: `vocabulary/${t.id}.md` })),
  { kind: 'Practice', id: spokenOrWritten.id, name: spokenOrWritten.title, level: '—', review: spokenOrWritten.review, page: 'practice/spoken-or-written.md' },
];
function summaryNotice(items, prefix = '') {
  const pending = items.filter((x) => x.review.status !== 'reviewed').length;
  if (!pending) return `> Every entry here has been reviewed by two native speakers.`;
  return `> **${pending} of ${items.length} entries are awaiting native-speaker review.** See the [review status](${prefix}review-status.md), or [help review](${REPO}/issues/new?template=reviewer.yml).`;
}
const GENERATED = '<!-- Generated by tools/build.mjs from content/. Edit the JSON, not this file. -->';
const page = (...parts) => [GENERATED, ...parts].join('\n\n') + '\n';

// --- Generate -------------------------------------------------------------

const files = new Map();
const emit = (path, content) => files.set(path, content);

// Grammar pages
for (const p of patterns) {
  const parts = [
    `# ${p.pattern} · *${p.jyutping}*`,
    `**Meaning:** ${p.meaning} · **Level:** ${p.level} · **Topic:** ${FUNCTIONS[p.function]}`,
    reviewNotice(p.review, `grammar/${p.id}`),
    p.explanation,
  ];
  if (p.writtenEquivalent) parts.push(`**Written Chinese:** ${p.writtenEquivalent.cjk} — ${p.writtenEquivalent.note}`);
  parts.push('## Examples', ...p.examples.map((ex) => sentenceTable(sentence(ex.words, ex.en))));
  if (p.mistakes?.length) {
    parts.push('## Common mistakes', p.mistakes.map((m) => {
      const s = sentence(m.correct);
      return `- Not ~~${m.incorrect}~~ but **${s.cjk}** *${s.jyutping}* · *${s.yale}*  \n  ${m.note}`;
    }).join('\n'));
  }
  if (p.related?.length) {
    const byId = new Map(patterns.map((x) => [x.id, x]));
    parts.push('## Related patterns', p.related.map((r) => `- [${byId.get(r).pattern}](${r}.md) — ${byId.get(r).meaning}`).join('\n'));
  }
  parts.push(`## Practise\n\nTry this pattern in the [${p.level} fill-the-gap worksheet](../practice/fill-the-gap-${p.level}.md).\n\n[← All grammar patterns](README.md)`);
  emit(`library/grammar/${p.id}.md`, page(...parts));
}

const grammarIndex = [
  '# Grammar patterns',
  `${patterns.length} patterns of everyday spoken Cantonese, each with at least three example sentences in 漢字, Jyutping, Yale, Bopomofo and English.`,
  summaryNotice(reviewables.filter((x) => x.kind === 'Grammar'), '../'),
];
for (const level of LEVELS) {
  const rows = patterns.filter((p) => p.level === level);
  grammarIndex.push(`## ${level}`, '| Pattern | Jyutping | Meaning | Topic | Review |', '|---|---|---|---|---|',
    rows.map((p) => `| [${p.pattern}](${p.id}.md) | ${p.jyutping} | ${p.meaning} | ${FUNCTIONS[p.function]} | ${p.review.status === 'reviewed' ? 'Reviewed' : 'Draft'} |`).join('\n'));
}
emit('library/grammar/README.md', page(...grammarIndex));

// Vocabulary pages
const vocabRow = (w, i) => {
  const r = word(w.cjk, w.jyutping);
  const clf = w.classifier ? `${w.classifier[0]} ${w.classifier[1]}` : '';
  return `| ${i + 1} | **${r.cjk}** | ${r.jyutping} | ${r.yale} | ${r.bopomofo} | ${w.en}${w.note ? ` ¹` : ''} | ${clf} |`;
};
for (const t of topics) {
  const notes = t.words.filter((w) => w.note).map((w) => `- **${w.cjk}** — ${w.note}`);
  emit(`library/vocabulary/${t.id}.md`, page(
    `# ${t.title} · ${t.titleCjk}`,
    reviewNotice(t.review, `vocabulary/${t.id}`),
    ...(t.note ? [t.note] : []),
    '| # | 漢字 | Jyutping | Yale | Bopomofo | English | Classifier |\n|---|---|---|---|---|---|---|\n' + t.words.map(vocabRow).join('\n'),
    ...(notes.length ? ['¹ **Usage notes**', notes.join('\n')] : []),
    'The **classifier** is the measure word used when counting or pointing: 一**部**電腦, 呢**間**醫院. See [Number + Classifier + Noun](../grammar/number-classifier.md).',
    '[← All topics](README.md)',
  ));
}
emit('library/vocabulary/README.md', page(
  '# Topic vocabulary',
  `${topics.reduce((n, t) => n + t.words.length, 0)} everyday words in ${topics.length} topics. Looking for a word in English? Use the [English index](../english-index.md).`,
  summaryNotice(reviewables.filter((x) => x.kind === 'Vocabulary'), '../'),
  '| Topic | 主題 | Words | Review |\n|---|---|---|---|\n' + topics.map((t) => `| [${t.title}](${t.id}.md) | ${t.titleCjk} | ${t.words.length} | ${t.review.status === 'reviewed' ? 'Reviewed' : 'Draft'} |`).join('\n'),
));

// English index
const sortKey = (en) => en.toLowerCase().replace(/^(to|a|an|the) /, '').replace(/[^a-z0-9 ]/g, '');
const indexRows = topics
  .flatMap((t) => t.words.map((w) => ({ ...word(w.cjk, w.jyutping), en: w.en, topic: t })))
  .sort((a, b) => sortKey(a.en).localeCompare(sortKey(b.en)));
const byLetter = Map.groupBy(indexRows, (r) => sortKey(r.en)[0].toUpperCase());
emit('library/english-index.md', page(
  '# English → Cantonese index',
  'Every word in the topic lists, sorted by its English meaning, with 漢字, Jyutping, Yale and Bopomofo side by side.',
  summaryNotice(reviewables.filter((x) => x.kind === 'Vocabulary')),
  [...byLetter.keys()].map((l) => `[${l}](#${l.toLowerCase()})`).join(' · '),
  ...[...byLetter].map(([letter, rows]) => `## ${letter}\n\n| English | 漢字 | Jyutping | Yale | Bopomofo | Topic |\n|---|---|---|---|---|---|\n` +
    rows.map((r) => `| ${r.en} | **${r.cjk}** | ${r.jyutping} | ${r.yale} | ${r.bopomofo} | [${r.topic.title}](vocabulary/${r.topic.id}.md) |`).join('\n')),
));

// Practice: fill the gap
for (const level of LEVELS) {
  const items = patterns.filter((p) => p.level === level).flatMap((p) => p.examples.filter((ex) => ex.gap).map((ex) => ({ p, ex })));
  const questions = [];
  const answers = [];
  items.forEach(({ p, ex }, i) => {
    const blanked = ex.words.map((w) => (w[0] === ex.gap.word ? ['＿＿', null] : w));
    const show = (convert) => blanked.map((w) => (w[1] === null ? '\\_\\_\\_' : w.length === 1 ? PUNCTUATION[w[0]] : convert(w[1]))).join(' ').replace(/ ([.,?!])/g, '$1');
    const options = shuffle([ex.gap.word, ...ex.gap.distractors], `${p.id}:${i}`);
    const letter = 'abcd'[options.indexOf(ex.gap.word)];
    questions.push(`**${i + 1}.** ${blanked.map((w) => w[0]).join('')}  \n${show(SYSTEMS.jyutping)}  \n*${show(SYSTEMS.yale)}*  \n“${ex.en}”\n\n${options.map((o, k) => `(${'abcd'[k]}) ${option(o)}`).join('  \n')}`);
    answers.push(`${i + 1}. **(${letter}) ${ex.gap.word}** — [${p.pattern}](../grammar/${p.id}.md): ${p.meaning}`);
  });
  emit(`library/practice/fill-the-gap-${level}.md`, page(
    `# Fill the gap — ${level}`,
    'Choose the word that completes each sentence so that it matches the English. Answers are at the bottom.',
    summaryNotice(reviewables.filter((x) => x.kind === 'Grammar' && x.level === level), '../'),
    questions.join('\n\n---\n\n'),
    `<details>\n<summary><strong>Answers</strong></summary>\n\n${answers.join('\n')}\n\n</details>`,
    '[← All practice](README.md)',
  ));
}

// Practice: build the sentence
{
  const items = patterns.map((p) => ({ p, ex: p.examples.find((ex) => ex.words.filter((w) => w.length === 2).length >= 4) })).filter((x) => x.ex);
  const questions = [];
  const answers = [];
  items.forEach(({ p, ex }, i) => {
    const tiles = ex.words.filter((w) => w.length === 2);
    let mixed = shuffle(tiles, `build:${p.id}`);
    if (mixed.every((w, k) => w === tiles[k])) mixed = [...mixed.slice(1), mixed[0]];
    const s = sentence(ex.words, ex.en);
    questions.push(`**${i + 1}.** “${ex.en}”\n\n${mixed.map(([c, j]) => `\`${c} ${j}\``).join(' ')}`);
    const also = (ex.accept ?? []).map((alt) => alt.join('')).join('; ');
    answers.push(`${i + 1}. **${s.cjk}** ${s.jyutping} · *${s.yale}* — [${p.pattern}](../grammar/${p.id}.md)${also ? ` (also correct: ${also})` : ''}`);
  });
  emit('library/practice/build-the-sentence.md', page(
    '# Build the sentence',
    'Put the word tiles in the right order to say the English sentence in Cantonese. Answers are at the bottom.',
    summaryNotice(reviewables.filter((x) => x.kind === 'Grammar'), '../'),
    questions.join('\n\n'),
    `<details>\n<summary><strong>Answers</strong></summary>\n\n${answers.join('\n')}\n\n</details>`,
    '[← All practice](README.md)',
  ));
}

// Practice: spoken or written
{
  const pool = spokenOrWritten.items.flatMap((item, i) => [
    { text: item.written, kind: 'written', item, n: i },
    { text: cjkOf(item.spoken), kind: 'spoken', item, n: i },
  ]);
  const quiz = shuffle(pool, 'spoken-or-written').slice(0, 20);
  const reference = spokenOrWritten.items.map((item) => {
    const s = sentence(item.spoken, item.en);
    return `| ${item.written} | **${s.cjk}** | ${s.jyutping} | ${s.yale} | ${s.en} | ${item.changes} |`;
  });
  emit('library/practice/spoken-or-written.md', page(
    '# Spoken or written?',
    'Much material sold as “Cantonese” is really Standard Written Chinese read aloud. Can you tell which sentences sound like natural spoken Cantonese? Answers and a full reference table are at the bottom.',
    reviewNotice(spokenOrWritten.review, 'practice/spoken-or-written'),
    quiz.map((q, i) => `**${i + 1}.** ${q.text} — spoken or written?`).join('  \n'),
    `<details>\n<summary><strong>Answers</strong></summary>\n\n${quiz.map((q, i) => `${i + 1}. **${q.kind}** — ${q.item.en} (${q.item.changes})`).join('\n')}\n\n</details>`,
    '## Reference: written → spoken',
    '| Written Chinese | Spoken Cantonese | Jyutping | Yale | English | What changes |\n|---|---|---|---|---|---|\n' + reference.join('\n'),
    '[← All practice](README.md)',
  ));
}

emit('library/practice/README.md', page(
  '# Practice',
  'Self-marking worksheets built from the grammar library. Every question links back to the pattern it practises. Prefer to practise interactively? Use the [practice site](https://jyltsang.github.io/Cantonlink-community/).',
  summaryNotice(reviewables, '../'),
  [
    '| Worksheet | What you practise |', '|---|---|',
    ...LEVELS.map((l) => `| [Fill the gap — ${l}](fill-the-gap-${l}.md) | Choosing the right grammar word for the meaning |`),
    '| [Build the sentence](build-the-sentence.md) | Cantonese word order |',
    '| [Spoken or written?](spoken-or-written.md) | Telling spoken Cantonese from written Chinese |',
  ].join('\n'),
  'For vocabulary flashcards, cover one column of any [topic list](../vocabulary/README.md) and test yourself.',
));

// Romanisation guide
{
  const toneRow = (t, cjk, en, contour) => { const j = `si${t}`; return `| ${t} | ${contour} | ${cjk} | ${j} | ${toYale(j)} | ${toBopomofo(j)} | ${en} |`; };
  emit('library/romanisation.md', page(
    '# Romanisation guide',
    'Every word in this library is written once, in **Jyutping**, by a human. **Yale** and **Bopomofo** are generated from it by [`tools/romanise.mjs`](../tools/romanise.mjs), so the three systems can never disagree.',
    '## The six tones',
    '| Tone | Pitch | 漢字 | Jyutping | Yale | Bopomofo | English |\n|---|---|---|---|---|---|---|\n' + [
      toneRow(1, '詩', 'poem', 'high level'), toneRow(2, '史', 'history', 'mid rising'), toneRow(3, '試', 'to try', 'mid level'),
      toneRow(4, '時', 'time', 'low falling'), toneRow(5, '市', 'market', 'low rising'), toneRow(6, '事', 'matter', 'low level'),
    ].join('\n'),
    '## How the systems differ',
    [
      '- **Jyutping** (Linguistic Society of Hong Kong, 1993) writes tones as numbers 1–6. It is the most widely used system today and is what you type with most Cantonese keyboards.',
      '- **Yale** (mid-20th century) shows tones with accents: macron (ā) tone 1, acute (á) tones 2 and 5, grave (à) tone 4, none for 3 and 6. An **h** after the vowel marks the low tones 4, 5 and 6. Many classic textbooks use it.',
      '- **Bopomofo** (注音符號) is familiar to readers from Taiwan. Standard Bopomofo cannot show Cantonese’s six tones or its long *aa* versus short *a*, so this library uses Bopomofo Extended letters (ㆭ ㆬ ㆴ ㆵ ㆶ ㆦ ㆤ), **ㄜ** for short *a*, and superscript tone numbers. It is a learning aid, not an official standard.',
    ].join('\n'),
    '## The Bopomofo scheme used here',
    [
      'Standard Bopomofo was designed for Mandarin, so writing Cantonese with it needs choices. This library makes them as follows, and applies them automatically to every syllable:',
      '',
      '- **Long *aa* and short *a* are different letters:** ㄚ for *aa* (家 gaa1 ㄍㄚ¹) and ㄜ for *a* (金 gam1 ㄍㄜㆬ¹), because the difference changes meaning (三 saam1 / 心 sam1).',
      '- **Cantonese-only sounds use Bopomofo Extended letters** from Unicode: ㆭ for *ng-*, ㆦ for *oe*, ㆤ for *eo*, ㆬ for final *-m*, and ㆴ ㆵ ㆶ for the unreleased final stops *-p*, *-t* and *-k*.',
      '- **Tones are superscript numbers ¹ to ⁶**, matching Jyutping, because Mandarin tone marks cannot show six Cantonese tones.',
      '- **The syllabic nasals** *m* and *ng* are written ㆬ and ㆭ on their own (唔 m4 ㆬ⁴, 五 ng5 ㆭ⁵).',
      '',
      'Bopomofo generated from Mandarin pinyin is a different thing: it gives the Mandarin pronunciation of the characters, not the Cantonese one. Do not mix the two.',
    ].join('\n'),
    '### Initials',
    '| Jyutping | Bopomofo | Example |\n|---|---|---|\n' + ['b', 'p', 'm', 'f', 'd', 't', 'n', 'l', 'g', 'k', 'ng', 'h', 'gw', 'kw', 'w', 'z', 'c', 's', 'j']
      .map((initial) => { const syl = `${initial}aa1`; return `| ${initial}- | ${toBopomofo(syl).replace(/ㄚ¹$/, '')} | ${syl} → ${toBopomofo(syl)} |`; }).join('\n'),
    '### Finals',
    'Each final is shown after *s-* in tone 1 so the letters can be compared; not every combination is a real word.',
    '| Jyutping | Bopomofo | Pattern |\n|---|---|---|\n' + ['aa', 'aai', 'aau', 'aam', 'aan', 'aang', 'aap', 'aat', 'aak', 'ai', 'au', 'am', 'an', 'ang', 'ap', 'at', 'ak',
      'e', 'ei', 'eng', 'ek', 'i', 'iu', 'im', 'in', 'ing', 'ip', 'it', 'ik', 'o', 'oi', 'ou', 'on', 'ong', 'ot', 'ok',
      'oe', 'oeng', 'oek', 'eoi', 'eon', 'eot', 'u', 'ui', 'un', 'ung', 'ut', 'uk', 'yu', 'yun', 'yut']
      .map((final) => { const syl = `s${final}1`; const bpmf = toBopomofo(syl); return `| -${final} | ${bpmf.replace(/^ㄙ/, '').replace(/¹$/, '')} | ${syl} → ${bpmf} |`; }).join('\n'),
    '## Spelling differences at a glance',
    '| Sound | Jyutping | Yale | Bopomofo | 漢字 |\n|---|---|---|---|---|\n' + [
      ['z', 'zoeng1', '張'], ['c', 'coeng4', '牆'], ['j', 'jat1', '一'], ['aa', 'gaa1', '家'], ['a', 'gam1', '金'],
      ['oe', 'hoeng1', '香'], ['eo', 'ceot1', '出'], ['yu', 'syu1', '書'], ['ng', 'ng5', '五'],
    ].map(([part, j, cjk]) => `| ${part} | ${j} | ${toYale(j)} | ${toBopomofo(j)} | ${cjk} |`).join('\n'),
    '## Convert your own text',
    '```sh\nnode tools/cli.mjs "nei5 hou2"\n```',
  ));
}

// Learning path
function dialogueTable(d) {
  const rows = d.lines.map((line) => {
    const s = sentence(line.words, line.en);
    return `| **${d.speakers[line.speaker]}** | ${s.cjk}<br>${s.jyutping}<br>*${s.yale}* | ${s.en} |`;
  });
  return [`**Model dialogue: ${d.title}**`, '| | Cantonese | English |\n|---|---|---|\n' + rows.join('\n')].join('\n\n');
}
{
  const byId = new Map(patterns.map((p) => [p.id, p]));
  const topicById = new Map(topics.map((t) => [t.id, t]));
  emit('library/path.md', page(
    '# Learning path',
    `${path.units.length} units that take you from A1 to B1. Each unit teaches a few grammar patterns with vocabulary, around an everyday situation. Work through them in order on the [learning site](${SITE}#/path), which tracks your progress, or read them here.`,
    ...path.units.map((u, i) => [
      `## ${i + 1}. ${u.title} · ${u.titleCjk} (${u.titleJyutping}) · ${u.level}`,
      `*${u.goal}*`,
      u.patterns.map((id) => `- [${byId.get(id).pattern}](grammar/${id}.md) — ${byId.get(id).meaning}`).join('\n'),
      `Vocabulary: ${u.topics.map((id) => `[${topicById.get(id).title}](vocabulary/${id}.md)`).join(', ')}`,
      dialogueTable(dialogues.find((d) => d.unit === u.id)),
    ].join('\n\n')),
  ));
}

emit('library/README.md', page(
  '# The library',
  summaryNotice(reviewables),
  [
    `- [Learning path](path.md) — ${path.units.length} units in teaching order`,
    `- [Grammar patterns](grammar/README.md) — ${patterns.length} patterns, A1–B1`,
    `- [Topic vocabulary](vocabulary/README.md) — ${topics.reduce((n, t) => n + t.words.length, 0)} words in ${topics.length} topics`,
    '- [English → Cantonese index](english-index.md)',
    '- [Practice worksheets](practice/README.md)',
    '- [Romanisation guide](romanisation.md) — Jyutping, Yale and Bopomofo',
    '- [Review status](review-status.md) — what has been checked by native speakers',
  ].join('\n'),
));

// Review status
{
  const done = reviewables.filter((x) => x.review.status === 'reviewed').length;
  const row = (x) => `| ${x.kind} | [${x.name}](${x.page}) | ${x.level} | ${x.review.status === 'reviewed' ? 'Reviewed' : x.review.reviewers.length >= 2 ? 'Needs re-checking' : `Draft (${x.review.reviewers.length}/2)`} | ${x.review.reviewers.join(', ') || '—'} |`;
  emit('library/review-status.md', page(
    '# Review status',
    `**${done} of ${reviewables.length} entries reviewed.** An entry counts as reviewed once two native speakers of Hong Kong Cantonese have checked it against the [review guide](../docs/REVIEW_GUIDE.md).`,
    `Want to help? [Volunteer as a reviewer](${REPO}/issues/new?template=reviewer.yml) — reviewers are credited by name.`,
    '| Type | Entry | Level | Status | Reviewers |\n|---|---|---|---|---|\n' + reviewables.map(row).join('\n'),
  ));
}

// Data file for apps and other projects
emit('dist/cantonlink-community.json', JSON.stringify({
  licence: 'CC BY-SA 4.0',
  source: 'https://github.com/jyltsang/cantonlink-community',
  grammar: patterns.map((p) => ({
    id: p.id, pattern: p.pattern, jyutping: p.jyutping, meaning: p.meaning, level: p.level, function: p.function,
    functionName: FUNCTIONS[p.function], explanation: p.explanation, writtenEquivalent: p.writtenEquivalent ?? null,
    examples: p.examples.map((ex) => ({ ...sentence(ex.words, ex.en), tokens: tokens(ex.words) })),
    mistakes: (p.mistakes ?? []).map((m) => ({ incorrect: m.incorrect, correct: sentence(m.correct), note: m.note })),
    related: p.related ?? [], review: p.review,
  })),
  vocabulary: topics.map((t) => ({
    id: t.id, title: t.title, titleCjk: t.titleCjk, ...(t.note ? { note: t.note } : {}), review: t.review,
    words: t.words.map((w) => ({ ...word(w.cjk, w.jyutping), en: w.en, pos: w.pos, ...(w.classifier ? { classifier: word(...w.classifier) } : {}), ...(w.note ? { note: w.note } : {}) })),
  })),
  path: path.units.map(({ titleCjk, titleJyutping, ...u }) => {
    const d = dialogues.find((x) => x.unit === u.id);
    return {
      ...u, titleWord: word(titleCjk, titleJyutping),
      dialogue: { title: d.title, speakers: d.speakers, lines: d.lines.map((line) => ({ speaker: line.speaker, ...sentence(line.words, line.en), tokens: tokens(line.words) })) },
    };
  }),
  practice: {
    fillGap: patterns.flatMap((p) => p.examples.map((ex, i) => ({ ex, i })).filter(({ ex }) => ex.gap).map(({ ex, i }) => ({
      id: `${p.id}:${i}`, patternId: p.id, level: p.level, en: ex.en, tokens: tokens(ex.words),
      gapIndex: ex.words.findIndex((w) => w[0] === ex.gap.word),
      options: [ex.gap.word, ...ex.gap.distractors].map((c) => word(c, lexicon.get(c))),
    }))),
    buildSentence: patterns.flatMap((p) => p.examples.map((ex, i) => ({ ex, i })).filter(({ ex }) => ex.words.filter((w) => w.length === 2).length >= 3).map(({ ex, i }) => ({
      id: `${p.id}:${i}`, patternId: p.id, level: p.level, en: ex.en, tokens: tokens(ex.words), ...(ex.accept ? { accept: ex.accept } : {}),
    }))),
    spokenOrWritten: { review: spokenOrWritten.review, items: spokenOrWritten.items.map((item) => ({ written: item.written, spoken: sentence(item.spoken, item.en), changes: item.changes })) },
  },
}, null, 2) + '\n');

emit('dist/schema.json', JSON.stringify(SCHEMA, null, 2) + '\n');

// Slim copy for the website; tools/data.mjs hydrate() turns it back into the
// full structure above (checked by tools/data.test.mjs).
{
  const pair = (cjk, jyutping) => [cjk, jyutping];
  const fillGap = patterns.flatMap((p) => p.examples.map((ex, i) => ({ ex, i })).filter(({ ex }) => ex.gap).map(({ ex, i }) => [
    `${p.id}:${i}`, ex.words.findIndex((w) => w[0] === ex.gap.word), [ex.gap.word, ...ex.gap.distractors].map((c) => pair(c, lexicon.get(c))),
  ]));
  const buildSentence = patterns.flatMap((p) => p.examples.map((ex, i) => ({ ex, i })).filter(({ ex }) => ex.words.filter((w) => w.length === 2).length >= 3).map(({ ex, i }) => (ex.accept ? [`${p.id}:${i}`, ex.accept] : `${p.id}:${i}`)));
  emit('dist/site-data.json', JSON.stringify({
    licence: 'CC BY-SA 4.0',
    source: 'https://github.com/jyltsang/cantonlink-community',
    slim: true,
    grammar: patterns.map((p) => ({
      id: p.id, pattern: p.pattern, jyutping: p.jyutping, meaning: p.meaning, level: p.level, function: p.function,
      functionName: FUNCTIONS[p.function], explanation: p.explanation, writtenEquivalent: p.writtenEquivalent ?? null,
      examples: p.examples.map((ex) => [ex.words, ex.en]),
      mistakes: (p.mistakes ?? []).map((m) => ({ incorrect: m.incorrect, correct: m.correct, note: m.note })),
      related: p.related ?? [], review: p.review,
    })),
    vocabulary: topics.map((t) => ({
      id: t.id, title: t.title, titleCjk: t.titleCjk, ...(t.note ? { note: t.note } : {}), review: t.review,
      words: t.words.map((w) => ({ cjk: w.cjk, jyutping: w.jyutping, en: w.en, pos: w.pos, ...(w.classifier ? { classifier: w.classifier } : {}), ...(w.note ? { note: w.note } : {}) })),
    })),
    path: path.units.map(({ titleCjk, titleJyutping, ...u }) => {
      const d = dialogues.find((x) => x.unit === u.id);
      return { ...u, titleWord: pair(titleCjk, titleJyutping), dialogue: { title: d.title, speakers: d.speakers, lines: d.lines.map((line) => [line.speaker, line.words, line.en]) } };
    }),
    practice: {
      fillGap, buildSentence,
      spokenOrWritten: { review: spokenOrWritten.review, items: spokenOrWritten.items.map((item) => ({ written: item.written, spoken: [item.spoken, item.en], changes: item.changes })) },
    },
  }) + '\n');
}

// --- Write or check -------------------------------------------------------

if (CHECK) {
  const stale = [...files].filter(([path, content]) => !existsSync(join(ROOT, path)) || readFileSync(join(ROOT, path), 'utf8') !== content).map(([p]) => p);
  if (stale.length) {
    console.error(`✗ Generated files are out of date. Run \`npm run build\`.\n  ${stale.join('\n  ')}`);
    process.exit(1);
  }
  console.log(`✓ ${files.size} generated files are up to date`);
} else {
  rmSync(join(ROOT, 'library'), { recursive: true, force: true });
  for (const [path, content] of files) {
    mkdirSync(dirname(join(ROOT, path)), { recursive: true });
    writeFileSync(join(ROOT, path), content);
  }
  console.log(`✓ Content valid · wrote ${files.size} files`);
}
