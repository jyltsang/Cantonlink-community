// Plain functions over the generated library data, shared by the MCP server
// and the website's AI tutor. No Node-only APIs, so it also runs in browsers.

import { parseSyllable, romanise } from './romanise.mjs';

export const LEVELS = ['A1', 'A2', 'B1'];

const fold = (text) => text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[1-6\s'’.,!?]/g, '');
const status = (review) => (review.status === 'reviewed' ? `reviewed by ${review.reviewers.join(' and ')}` : 'draft, awaiting native-speaker review');

export function searchVocabulary(data, query, limit = 10) {
  const q = query.trim();
  const fq = fold(q);
  if (!fq) return [];
  const words = data.vocabulary.flatMap((t) => t.words.map((w) => ({ ...w, topic: t.id, topicTitle: t.title })));
  const score = (w) => {
    if (w.cjk === q || fold(w.jyutping) === fq || fold(w.en) === fq) return 3;
    if (fold(w.en).split(/;|,/).some((part) => part.trim() === fq)) return 2;
    if (w.cjk.includes(q) || fold(w.jyutping).startsWith(fq) || fold(w.yale).startsWith(fq) || fold(w.en).includes(fq)) return 1;
    return 0;
  };
  return words.map((w) => ({ w, s: score(w) })).filter((x) => x.s > 0).sort((a, b) => b.s - a.s).slice(0, limit).map((x) => x.w);
}

export function formatWord(w) {
  const parts = [`${w.cjk} — ${w.jyutping} | Yale: ${w.yale} | Bopomofo: ${w.bopomofo} — ${w.en} (${w.pos})`];
  if (w.classifier) parts.push(`  classifier: ${w.classifier.cjk} ${w.classifier.jyutping}`);
  if (w.note) parts.push(`  note: ${w.note}`);
  if (w.topicTitle) parts.push(`  topic: ${w.topicTitle}`);
  return parts.join('\n');
}

export function listPatterns(data, level) {
  return data.grammar.filter((p) => !level || p.level === level);
}

export function findPattern(data, id) {
  return data.grammar.find((p) => p.id === id);
}

export function suggestPatterns(data, text, limit = 5) {
  const f = fold(text);
  return data.grammar.filter((p) => fold(p.id).includes(f) || fold(p.meaning).includes(f) || p.pattern.includes(text)).slice(0, limit);
}

export function formatPattern(p) {
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

export function formatTopic(t) {
  return [`# ${t.title} (${t.titleCjk})`, `status: ${status(t.review)}`, '', ...t.words.map((w) => formatWord(w))].join('\n');
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

export function practiceQuestions(data, type, { level, count = 5 } = {}) {
  const byLevel = (q) => !level || q.level === level;
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
      return { question: `${n + 1}. "${q.en}"\n   Words: ${tiles}`, answer: `${n + 1}. ${answer} (${jp}) — pattern ${q.patternId}` };
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
