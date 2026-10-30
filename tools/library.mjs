// Plain functions over the generated library data, shared by the MCP server
// and the website's AI tutor. No Node-only APIs, so it also runs in browsers.

import { parseSyllable, romanise, toYale } from './romanise.mjs';

export const LEVELS = ['A1', 'A2', 'B1'];

const fold = (text) => text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[1-6\s'’.,!?]/g, '');
const status = (review) => (review.status === 'reviewed' ? `reviewed by ${review.reviewers.join(' and ')}` : 'draft, awaiting native-speaker review');

// --- Search ---------------------------------------------------------------
// Learners who do not read characters type what they hear: tones left out,
// Yale without its marks, syllables run together, l for n. Each word is
// matched in its stored Jyutping and its stored Yale separately, so the two
// systems' spellings (Jyutping z is Yale j) never collide.

const HAN = /\p{Script=Han}/u;
const plain = (text) => text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

// Spellings that name the same syllable for many speakers and learners: an
// initial n said as l, a dropped ng-, and the vowel Jyutping writes oe or eo
// and Yale writes eu.
const variant = (letters) => letters.replace(/^n(?!g)/, 'l').replace(/^ng(?=[aeiou])/, '').replace(/oe|eo/g, 'eu');

// A syllable in the library: its tone, and the ways it can be spelt without
// a tone (Jyutping letters, bare Yale, Yale with its low-tone h).
function storedSyllable(jyutping) {
  const parsed = parseSyllable(jyutping);
  if (!parsed) return { tone: null, spellings: new Set([plain(jyutping)]) };
  const letters = jyutping.slice(0, -1);
  return { tone: parsed.tone, spellings: new Set([letters, plain(toYale(`${letters}1`)), plain(toYale(jyutping))]) };
}

// A syllable the learner typed, with its tone if they gave one: a Jyutping
// number, or a Yale mark (Yale writes the low tones with an h after the vowel).
const YALE_MARKS = { '̄': 1, '́': 2, '̀': 4 };
function typedSyllable(token) {
  const nfd = token.normalize('NFD').toLowerCase();
  const letters = nfd.replace(/[\p{M}1-6]/gu, '');
  const number = /[1-6]$/.exec(nfd);
  if (number) return { letters, tone: Number(number[0]) };
  const mark = [...nfd].map((ch) => YALE_MARKS[ch]).find(Boolean);
  if (!mark) return { letters, tone: null };
  const low = letters.replace(/^c?h/, '').slice(1).includes('h');
  return { letters, tone: mark === 2 && low ? 5 : mark };
}

// 4 spelling and tone match, 3 spelling matches and no tone was given,
// 2 a variant spelling, 1 the right syllable with a different tone, 0 none.
function syllableScore(typed, stored) {
  const spelled = stored.spellings.has(typed.letters);
  if (!spelled && ![...stored.spellings].some((s) => variant(s) === variant(typed.letters))) return 0;
  if (typed.tone !== null && stored.tone !== null && typed.tone !== stored.tone) return 1;
  if (!spelled) return 2;
  return typed.tone === null ? 3 : 4;
}

// Splits a run such as "neihou" into the syllables the library knows,
// using as few as possible.
function segment(text, known) {
  const best = [[]];
  for (let end = 1; end <= text.length; end++) {
    for (let start = Math.max(0, end - 7); start < end; start++) {
      const piece = text.slice(start, end);
      if (best[start] && (known.has(piece) || known.has(variant(piece))) && (!best[end] || best[start].length + 1 < best[end].length)) best[end] = [...best[start], piece];
    }
  }
  return best[text.length] ?? null;
}

function typedSyllables(query, known) {
  const tokens = query.normalize('NFD').toLowerCase().replace(/([1-6])(?=\p{L})/gu, '$1 ').split(/[\s'’.,!?;:()/-]+/).filter(Boolean);
  return tokens.flatMap((token) => {
    if (/[\p{M}1-6]/u.test(token) || token.length < 4 || known.has(token) || known.has(variant(token))) return [token];
    return segment(token, known) ?? [token];
  }).map(typedSyllable);
}

const englishWords = (text) => plain(text).replace(/[^a-z0-9]+/g, ' ').trim().split(' ').filter(Boolean);
const stem = (word) => (word.length > 5 ? word.replace(/ing$/, '') : word).replace(/(?<=...)s$/, '');
const stems = (text) => englishWords(text).map(stem).join(' ');

function distance(a, b) {
  if (Math.abs(a.length - b.length) > 1) return 2;
  let row = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const next = [i];
    for (let j = 1; j <= b.length; j++) next[j] = Math.min(row[j] + 1, next[j - 1] + 1, row[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    row = next;
  }
  return row[b.length];
}

const syllablesIn = (jyutping) => (jyutping.match(/[a-z]+[1-6]/g) ?? []).filter((s) => parseSyllable(s)).map(storedSyllable);

const INDEX = new WeakMap();
function libraryIndex(data) {
  if (!INDEX.has(data)) {
    const entries = data.vocabulary.flatMap((t) => t.words.map((w) => {
      const word = { ...w, topic: t.id, topicTitle: t.title };
      const syllables = w.jyutping.trim().split(/\s+/).map(storedSyllable);
      const runs = [0, 1, 2].map((i) => syllables.map((s) => [...s.spellings][i] ?? [...s.spellings][0]).join(''));
      const parts = w.en.split(/;|,/).map((part) => stems(part).replace(/^to /, ''));
      return { word, syllables, runs, en: stems(w.en), parts };
    }));
    const all = [...entries.flatMap((e) => e.syllables), ...data.grammar.flatMap((p) => [p.jyutping, ...p.examples.map((ex) => ex.jyutping)].flatMap(syllablesIn))];
    const known = new Set(all.flatMap((s) => [...s.spellings].flatMap((x) => [x, variant(x)])));
    INDEX.set(data, { entries, known });
  }
  return INDEX.get(data);
}

// The words that match a query, best first. A result is approximate when
// only a different tone or a one-letter slip connects it to the query.
export function searchWords(data, query, limit = 10) {
  const q = query.trim();
  const fq = fold(q);
  if (!fq) return [];
  const { entries, known } = libraryIndex(data);
  const typed = typedSyllables(q, known);
  const run = typed.map((t) => t.letters).join('');
  const toned = typed.some((t) => t.tone !== null);
  const qStems = stems(q).replace(/^to /, '');
  const score = (e) => {
    const { word } = e;
    if (word.cjk === q || (qStems && e.en === qStems)) return 10;
    let best = 0;
    if (typed.length === e.syllables.length) {
      const roman = Math.min(...typed.map((t, i) => syllableScore(t, e.syllables[i])));
      best = [0, 3, 6, 8, 9][roman];
    }
    if (qStems && e.parts.includes(qStems)) best = Math.max(best, 7);
    // The start of a longer word: whole syllables (any tones given must match),
    // or, when no tones were given, letters.
    const syllablePrefix = typed.length < e.syllables.length && typed.every((t, i) => syllableScore(t, e.syllables[i]) >= 2);
    const letterPrefix = (roman) => !toned && roman.length > fq.length && roman.startsWith(fq);
    const english = qStems.length >= 3 && ` ${e.en} `.includes(` ${qStems} `);
    if ((HAN.test(q) && word.cjk.includes(q)) || syllablePrefix || letterPrefix(fold(word.jyutping)) || letterPrefix(fold(word.yale)) || english) best = Math.max(best, 5);
    if (!best && run.length >= 4 && e.runs.some((r) => distance(run, r) <= 1)) best = 2;
    return best;
  };
  return entries.map((e) => ({ word: e.word, score: score(e) })).filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score).slice(0, limit).map((r) => ({ ...r, approx: r.score <= 3 }));
}

export function searchVocabulary(data, query, limit = 10) {
  return searchWords(data, query, limit).map((r) => r.word);
}

// --- Display --------------------------------------------------------------
// By default Cantonese is shown in characters with Jyutping, as the website's
// tutor expects. The MCP server can instead show romanisation only, for
// learners who do not read characters: then no characters appear anywhere.

const DEFAULT_DISPLAY = { characters: true, romanisation: 'jyutping' };
const SYSTEM_NAMES = { jyutping: 'Jyutping', yale: 'Yale' };
// Array.map passes an index as the second argument: treat it as the default.
const displayOf = (display) => (display && typeof display === 'object' ? { ...DEFAULT_DISPLAY, ...display } : DEFAULT_DISPLAY);
const otherSystem = (system) => (system === 'yale' ? 'jyutping' : 'yale');
// Adjacent words get a space between their readings, as on the website.
const readParts = (parts, system) => parts.map((part, i) => (typeof part === 'string' ? part : `${typeof parts[i - 1] === 'object' ? ' ' : ''}${part[system]}`)).join('');
const prose = (text, parts, system) => (parts ? readParts(parts, system) : text);
const joinTokens = (readings) => readings.join(' ').replace(/ ([.,?!])/g, '$1');

export function formatWord(w, display) {
  const { characters, romanisation: system } = displayOf(display);
  const other = otherSystem(system);
  const parts = characters
    ? [`${w.cjk} — ${w.jyutping} | Yale: ${w.yale} | Bopomofo: ${w.bopomofo} — ${w.en} (${w.pos})`]
    : [`${w[system]} | ${SYSTEM_NAMES[other]}: ${w[other]} — ${w.en} (${w.pos})`];
  if (w.classifier) parts.push(characters ? `  classifier: ${w.classifier.cjk} ${w.classifier.jyutping}` : `  classifier: ${w.classifier[system]}`);
  if (w.note) parts.push(`  note: ${characters ? w.note : prose(w.note, w.noteParts, system)}`);
  if (w.topicTitle) parts.push(`  topic: ${w.topicTitle}`);
  return parts.join('\n');
}

export function patternName(p, display) {
  const { characters, romanisation: system } = displayOf(display);
  return characters ? p.pattern : p.patternRomanised[system];
}

export function listPatterns(data, level) {
  return data.grammar.filter((p) => !level || p.level === level);
}

export function findPattern(data, id) {
  return data.grammar.find((p) => p.id === id);
}

export function suggestPatterns(data, text, limit = 5) {
  const f = fold(text);
  const typed = typedSyllables(text, libraryIndex(data).known);
  const sounds = (p) => {
    const stored = syllablesIn(p.jyutping);
    return typed.length > 0 && stored.some((_, i) => typed.every((t, k) => stored[i + k] && syllableScore(t, stored[i + k]) >= 2));
  };
  return data.grammar.filter((p) => fold(p.id).includes(f) || fold(p.meaning).includes(f) || p.pattern.includes(text) || sounds(p)).slice(0, limit);
}

export function formatPattern(p, display) {
  const { characters, romanisation: system } = displayOf(display);
  const other = otherSystem(system);
  if (!characters) {
    // Written Chinese forms are left out, as on the website with characters off.
    const lines = [
      `# ${p.patternRomanised[system]}`,
      `id: ${p.id} · level: ${p.level} · topic: ${p.functionName} · status: ${status(p.review)}`,
      `Meaning: ${p.meaning}`,
      '',
      prose(p.explanation, p.explanationParts, system),
      '',
      '## Examples',
    ];
    for (const ex of p.examples) lines.push(`- ${ex[system]}`, `  ${SYSTEM_NAMES[other]}: ${ex[other]}`, `  English: ${ex.en}`);
    if (p.mistakes.length) {
      lines.push('', '## Common mistakes');
      for (const m of p.mistakes) lines.push(`- Say ${m.correct[system]} (${SYSTEM_NAMES[other]}: ${m.correct[other]}). ${prose(m.note, m.noteParts, system)}`);
    }
    if (p.related.length) lines.push('', `Related patterns: ${p.related.join(', ')}`);
    return lines.join('\n');
  }
  const lines = [
    `# ${p.pattern} (${p.jyutping})`,
    `id: ${p.id} · level: ${p.level} · topic: ${p.functionName} · status: ${status(p.review)}`,
    `Meaning: ${p.meaning}`,
    '',
    p.explanation,
  ];
  if (p.writtenEquivalent) lines.push('', `Written Chinese uses ${p.writtenEquivalent.cjk}: ${p.writtenEquivalent.note}`);
  lines.push('', '## Examples');
  for (const ex of p.examples) lines.push(`- ${ex.cjk}`, `  Jyutping: ${ex.jyutping}`, `  Yale: ${ex.yale}`, `  English: ${ex.en}`);
  if (p.mistakes.length) {
    lines.push('', '## Common mistakes');
    for (const m of p.mistakes) lines.push(`- Avoid ${m.incorrect} — say ${m.correct.cjk} (${m.correct.jyutping}). ${m.note}`);
  }
  if (p.related.length) lines.push('', `Related patterns: ${p.related.join(', ')}`);
  return lines.join('\n');
}

export function formatTopic(t, display) {
  const { characters, romanisation: system } = displayOf(display);
  const title = characters ? t.titleCjk : t.titleWord[system];
  return [`# ${t.title} (${title})`, `status: ${status(t.review)}`, '', ...t.words.map((w) => formatWord(w, display))].join('\n');
}

// --- Romanisation ---------------------------------------------------------

export function convertJyutping(text) {
  const syllables = text.trim().toLowerCase().split(/[\s,.!?]+/).filter(Boolean);
  const invalid = syllables.filter((s) => !parseSyllable(s));
  if (!syllables.length || invalid.length) return { invalid };
  return romanise(syllables.join(' '));
}

// --- Written-Chinese check ------------------------------------------------
// A heuristic, not a parser: it flags common Standard Written Chinese forms
// in text meant to be spoken Cantonese, and skips spoken words that happen to
// contain the same characters (的士, 其他, 不過…).

const WRITTEN_FORMS = [
  ['他們', '佢哋'], ['她們', '佢哋'], ['我們', '我哋'], ['你們', '你哋'], ['他', '佢'], ['她', '佢'], ['它', '佢'],
  ['是', '係'], ['的', '嘅'], ['不要', '唔好'], ['不用', '唔使'], ['不會', '唔會 / 唔識'], ['不是', '唔係'], ['不', '唔'],
  ['沒有', '冇'], ['沒', '冇'], ['了', '咗 (after a verb) or 喇 (at the end)'], ['在', '喺'],
  ['這裏', '呢度'], ['這個', '呢個'], ['這', '呢'], ['那裏', '嗰度'], ['那個', '嗰個'], ['那', '嗰'], ['哪裏', '邊度'], ['哪', '邊'],
  ['為什麼', '點解'], ['為甚麼', '點解'], ['甚麼', '乜嘢 / 咩'], ['什麼', '乜嘢 / 咩'], ['怎麼', '點'], ['怎樣', '點樣'],
  ['很', '好'], ['吃', '食'], ['喝', '飲'], ['看', '睇'], ['說', '講 / 話'], ['給', '畀'], ['被', '畀'], ['吧', '啦'], ['和', '同'],
  ['還是', '定係'], ['現在', '而家'], ['明天', '聽日'], ['今天', '今日'], ['昨天', '尋日'], ['東西', '嘢'], ['喜歡', '鍾意'],
  ['知道', '知'], ['睡覺', '瞓覺'], ['對不起', '對唔住'], ['謝謝', '多謝 / 唔該'], ['一起', '一齊'], ['多少', '幾多'], ['誰', '邊個'], ['怎麼樣', '點樣'], ['一下', '吓'], ['回家', '返屋企'], ['錢包', '銀包'], ['老闆', '老細'], ['漂亮', '靚'], ['走路', '行路'],
];
const SPOKEN_EXCEPTIONS = [
  '的士', '的確', '目的', '其他', '是但', '不過', '不如', '不得了', '不停', '不斷', '不知不覺', '了解', '為了', '吃虧', '看法',
  '實在', '存在', '自在', '小說', '說話', '和尚', '和平', '溫和', '棉被', '被鋪', '被竇', '酒吧', '網吧',
];
const longestFirst = (list) => [...list].sort((a, b) => b.length - a.length);
const EXCEPTIONS = longestFirst(SPOKEN_EXCEPTIONS);
const FORMS = [...WRITTEN_FORMS].sort((a, b) => b[0].length - a[0].length);

export function checkSpoken(text) {
  const findings = [];
  for (let i = 0; i < text.length;) {
    const exception = EXCEPTIONS.find((e) => text.startsWith(e, i));
    if (exception) {
      i += exception.length;
      continue;
    }
    const form = FORMS.find(([written]) => text.startsWith(written, i));
    if (form) {
      findings.push({ written: form[0], spoken: form[1], index: i, context: text.slice(Math.max(0, i - 4), i + form[0].length + 4) });
      i += form[0].length;
    } else {
      i++;
    }
  }
  return findings;
}

// --- Practice questions ---------------------------------------------------

function pick(items, count) {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out.slice(0, count);
}

export function practiceQuestions(data, type, { level, count = 5, display } = {}) {
  const byLevel = (q) => !level || q.level === level;
  const { characters, romanisation: system } = displayOf(display);
  if (!characters) {
    if (type === 'fill_the_gap') {
      return pick(data.practice.fillGap.filter(byLevel), count).map((q, n) => {
        const line = joinTokens(q.tokens.map((t, i) => (i === q.gapIndex ? '___' : t.punctuation ?? t[system])));
        const options = pick(q.options, 4).map((o) => o[system]).join(' / ');
        return { question: `${n + 1}. "${q.en}"\n   ${line}\n   Options: ${options}`, answer: `${n + 1}. ${q.options[0][system]} — pattern ${q.patternId}` };
      });
    }
    if (type === 'build_the_sentence') {
      return pick(data.practice.buildSentence.filter(byLevel), count).map((q, n) => {
        const words = q.tokens.filter((t) => !t.punctuation);
        const reading = new Map(words.map((t) => [t.cjk, t[system]]));
        const tiles = pick(words, words.length).map((t) => `[${t[system]}]`).join(' ');
        const answer = joinTokens(q.tokens.map((t) => t.punctuation ?? t[system]));
        const also = q.accept?.length ? `; also correct: ${q.accept.map((order) => order.map((cjk) => reading.get(cjk)).join(' ')).join(', ')}` : '';
        return { question: `${n + 1}. "${q.en}"\n   Words: ${tiles}`, answer: `${n + 1}. ${answer} — pattern ${q.patternId}${also}` };
      });
    }
    throw new Error('Spoken-or-written questions show Chinese characters, so they are not available when characters are off.');
  }
  if (type === 'fill_the_gap') {
    return pick(data.practice.fillGap.filter(byLevel), count).map((q, n) => {
      const sentence = q.tokens.map((t, i) => (i === q.gapIndex ? '＿＿' : t.cjk)).join('');
      const jyutping = q.tokens.map((t, i) => (i === q.gapIndex ? '___' : t.punctuation ?? t.jyutping)).join(' ').replace(/ ([.,?!])/g, '$1');
      const options = pick(q.options, 4).map((o) => `${o.cjk} (${o.jyutping})`).join(' / ');
      return { question: `${n + 1}. "${q.en}"\n   ${sentence}\n   ${jyutping}\n   Options: ${options}`, answer: `${n + 1}. ${q.options[0].cjk} (${q.options[0].jyutping}) — pattern ${q.patternId}` };
    });
  }
  if (type === 'build_the_sentence') {
    return pick(data.practice.buildSentence.filter(byLevel), count).map((q, n) => {
      const words = q.tokens.filter((t) => !t.punctuation);
      const tiles = pick(words, words.length).map((t) => `[${t.cjk} ${t.jyutping}]`).join(' ');
      const answer = q.tokens.map((t) => t.cjk).join('');
      const jp = q.tokens.map((t) => t.punctuation ?? t.jyutping).join(' ').replace(/ ([.,?!])/g, '$1');
      const also = q.accept?.length ? `; also correct: ${q.accept.map((order) => order.join('')).join(', ')}` : '';
      return { question: `${n + 1}. "${q.en}"\n   Words: ${tiles}`, answer: `${n + 1}. ${answer} (${jp}) — pattern ${q.patternId}${also}` };
    });
  }
  const pool = data.practice.spokenOrWritten.items.flatMap((item) => [
    { text: item.written, kind: 'written', item },
    { text: item.spoken.cjk, kind: 'spoken', item },
  ]);
  return pick(pool, count).map((q, n) => ({
    question: `${n + 1}. ${q.text} — spoken Cantonese or written Chinese?`,
    answer: `${n + 1}. ${q.kind}. Spoken form: ${q.item.spoken.cjk} (${q.item.spoken.jyutping}). Changes: ${q.item.changes}`,
  }));
}

// --- Checks shared by the build and the AI tutor --------------------------

const LATIN_WORD = /[A-Za-z][A-Za-z0-9'+.#-]*/g;

// One Jyutping syllable per Chinese character. English words mixed into
// Cantonese (寫 code) appear unchanged in both fields and are not counted.
export function checkWordAlignment(cjk, jyutping) {
  const latin = new Set((cjk.match(LATIN_WORD) ?? []).map((w) => w.toLowerCase()));
  const syllables = jyutping.trim().split(/\s+/).filter((t) => t && !latin.has(t.toLowerCase()));
  const invalid = syllables.filter((s) => !parseSyllable(s));
  const han = (cjk.match(/\p{Script=Han}/gu) ?? []).length;
  return { ok: !invalid.length && han === syllables.length, invalid, han, syllables: syllables.length };
}

// Every reading the library gives each word, from word lists and examples.
export function buildLexicon(data) {
  const lexicon = new Map();
  const add = (cjk, jyutping) => {
    if (!cjk || !jyutping) return;
    if (!lexicon.has(cjk)) lexicon.set(cjk, new Set());
    lexicon.get(cjk).add(jyutping);
  };
  for (const t of data.vocabulary) {
    for (const w of t.words) {
      add(w.cjk, w.jyutping);
      if (w.classifier) add(w.classifier.cjk, w.classifier.jyutping);
    }
  }
  for (const p of data.grammar) for (const ex of p.examples) for (const t of ex.tokens ?? []) add(t.cjk, t.jyutping);
  for (const q of [...data.practice.fillGap, ...data.practice.buildSentence]) for (const t of q.tokens) add(t.cjk, t.jyutping);
  return lexicon;
}
