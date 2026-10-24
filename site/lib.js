import { schedule, migrate, dueKeys, endOfDay, nextDue } from './srs.js';

export const REPO = 'https://github.com/jyltsang/Cantonlink-community';
export const SYSTEM_LANG = { jyutping: 'yue-Latn', yale: 'yue-Latn', bopomofo: 'yue-Bopo' };
export const SYSTEM_NAME = { jyutping: 'Jyutping', yale: 'Yale', bopomofo: 'Bopomofo' };
export const LEVELS = ['A1', 'A2', 'B1'];

// --- Browser storage (optional: the site works without it) ---------------

function read(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key) ?? 'null') ?? fallback;
  } catch {
    return fallback;
  }
}
function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Private browsing or blocked storage: keep going for this visit only.
  }
}

// Characters are off by default: romanisation comes first, and learners turn
// 漢字 on under Display when they want them.
export const settings = { system: 'jyutping', showCjk: false, ...read('cantonlink-settings', {}) };
export const saveSettings = () => write('cantonlink-settings', settings);

// Missed items go into a spaced-repetition schedule (see srs.js). Keys look
// like "fill:hai6-copula:0", "build:…", "tone:飲:0" or "card:food-and-dim-sum:飲".
const EMPTY = () => ({ review: {}, phrases: {}, done: {}, answered: 0, correct: 0 });
function loadProgress(saved) {
  const { mistakes, review, ...rest } = saved ?? {};
  return { ...EMPTY(), ...rest, review: migrate({ ...mistakes, ...review }) };
}
const progress = loadProgress(read('cantonlink-progress', {}));
const saveProgress = () => write('cantonlink-progress', progress);
const changed = () => {
  saveProgress();
  document.dispatchEvent(new CustomEvent('progresschange'));
};

export function recordAnswer(key, isCorrect, { reviewing = false } = {}) {
  progress.answered++;
  if (isCorrect) {
    progress.correct++;
    progress.done[key] = 1;
  }
  if (!isCorrect || reviewing) {
    const next = schedule(progress.review[key], isCorrect);
    if (next) progress.review[key] = next;
    else delete progress.review[key];
  }
  changed();
}
// Practice that has no right or wrong answer (revealing a Try first line):
// counts towards a unit's progress without touching the score.
export function markDone(key) {
  if (progress.done[key]) return;
  progress.done[key] = 1;
  changed();
}
export const reviewKeys = () => dueKeys(progress.review);
export const isDone = (key) => Boolean(progress.done[key]);
export const reviewBox = (key) => progress.review[key]?.box;

// Phrases saved from verified AI tutor replies, reviewed like flashcards.
export function savePhrase(sentence) {
  progress.phrases[sentence.cjk] = { cjk: sentence.cjk, jyutping: sentence.jyutping, en: sentence.en, tokens: sentence.tokens };
  progress.review[`phrase:${sentence.cjk}`] = schedule(undefined, false);
  changed();
}
export const isPhraseSaved = (cjk) => Boolean(progress.phrases[cjk]);
export const savedPhrase = (cjk) => progress.phrases[cjk];
export const stats = () => ({
  answered: progress.answered,
  correct: progress.correct,
  toReview: reviewKeys().length,
  dueToday: dueKeys(progress.review, endOfDay()).length,
  scheduled: Object.keys(progress.review).length,
  nextDue: nextDue(progress.review),
});

export function whenDue(time) {
  const date = new Date(time);
  if (time <= endOfDay()) return `today at ${date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
  return `on ${date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}`;
}

export function exportProgress() {
  return JSON.stringify({ app: 'cantonlink-community', version: 1, exported: new Date().toISOString(), settings, progress }, null, 2);
}
export function importProgress(text) {
  const data = JSON.parse(text);
  if (data?.app !== 'cantonlink-community' || typeof data.progress !== 'object') throw new Error('This file is not a CantonLink progress file.');
  Object.assign(progress, loadProgress(data.progress));
  Object.assign(settings, data.settings ?? {});
  saveSettings();
  changed();
}
export function resetProgress() {
  Object.assign(progress, EMPTY());
  changed();
}

// --- DOM helpers ----------------------------------------------------------

export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === false || value == null) continue;
    if (key.startsWith('on')) el.addEventListener(key.slice(2), value);
    else if (key === 'class') el.className = value;
    else el.setAttribute(key, value === true ? '' : value);
  }
  for (const child of children.flat(Infinity)) if (child != null && child !== false) el.append(child);
  return el;
}

export const app = document.getElementById('app');
export function show(...nodes) {
  app.replaceChildren(...nodes.flat().filter((n) => n != null && n !== false));
}

export function shuffle(items) {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
export const sample = (items, n) => shuffle(items).slice(0, n);

export const reportUrl = (entry) => `${REPO}/issues/new?template=content-error.yml&title=${encodeURIComponent(`[Correction] ${entry}`)}`;

// Lower-case, without tone numbers, accents or spaces, for forgiving search.
export const fold = (text) => text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[1-6\s'’.,!?]/g, '');

// --- Cantonese rendering --------------------------------------------------

// Jyutping tone numbers become superscripts (nei⁵ hou²). The digits stay in
// the text, so copying and screen readers still get "nei5 hou2".
export function romText(text, system = settings.system) {
  if (system !== 'jyutping' || !text) return [text];
  return text.split(/(?<=[a-z])([1-6])(?![0-9])/i).map((part, i) => (i % 2 ? h('sup', { class: 'tone' }, part) : part)).filter((part) => part !== '');
}
const romClass = (cls) => (settings.system === 'jyutping' ? `${cls} jp` : cls);
export const rom = (word, cls = 'rom') => h('span', { class: romClass(cls), lang: SYSTEM_LANG[settings.system] }, romText(word[settings.system]));
export const han = (word, cls = 'han') => (settings.showCjk ? h('span', { class: cls, lang: 'yue-Hant-HK' }, word.cjk) : null);

export function sentenceEl(tokens, { blankIndex = -1, filled = null, highlight = -1 } = {}) {
  return h('p', { class: 'sentence' }, tokens.map((t, i) => {
    if (t.punctuation) return h('span', { class: 'word punct' }, h('span', { class: 'rom' }, settings.system === 'bopomofo' ? t.cjk : t.punctuation));
    if (i === blankIndex) {
      const w = filled ?? { cjk: '＿＿', jyutping: ' ', yale: ' ', bopomofo: ' ' };
      return h('span', { class: 'word blank' }, rom(w), han(w));
    }
    return h('span', { class: `word${i === highlight ? ' highlight' : ''}` }, rom(t), han(t));
  }));
}

export function sentenceText(sentence) {
  return h('span', { class: 'dual' },
    h('span', { class: romClass('dual-rom'), lang: SYSTEM_LANG[settings.system] }, romText(sentence[settings.system])),
    settings.showCjk ? h('span', { class: 'dual-cjk cjk', lang: 'yue-Hant-HK' }, sentence.cjk) : null);
}

// --- Shared page pieces ---------------------------------------------------

export function pageHead(title, { back = ['#/', 'Home'], lede } = {}) {
  return [
    h('nav', { class: 'crumbs', 'aria-label': 'Breadcrumb' }, h('a', { href: back[0] }, `← ${back[1]}`)),
    h('h1', {}, title),
    lede ? h('p', { class: 'lede' }, lede) : null,
  ];
}

export function chips(options, current, onPick, label) {
  return h('div', { class: 'chip-row', role: 'group', 'aria-label': label },
    options.map(([value, text]) => h('button', { class: 'chip', type: 'button', 'aria-pressed': String(value === current), onclick: () => onPick(value) }, text)));
}

export const tag = (text, kind = '') => h('span', { class: `tag ${kind}` }, text);
export const draftTag = (review) => (review.status === 'reviewed' ? tag('Reviewed', 'tag-good') : tag('Draft', 'tag-draft'));

export const reportLine = (entry) => h('p', { class: 'report' }, 'Something unnatural? ', h('a', { href: reportUrl(entry), target: '_blank', rel: 'noopener' }, 'Report it'));

export function parseHash() {
  const [path, query = ''] = location.hash.replace(/^#\/?/, '').split('?');
  return { parts: path.split('/').filter(Boolean).map(decodeURIComponent), query: new URLSearchParams(query) };
}
