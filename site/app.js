import { settings, saveSettings, h, show, parseHash, stats } from './lib.js';
import { home, grammarList, grammarDetail, vocabularyList, vocabularyTopic, lookup, notFound } from './learn.js';
import { flashcards, fillTheGap, buildTheSentence, tones, spokenOrWritten, review } from './practice.js';

let data;
let rerender = () => {};
let grammarLevel = 'all';

const TITLES = {
  '': 'Learn Cantonese', grammar: 'Grammar', vocabulary: 'Vocabulary', lookup: 'Look up', flashcards: 'Flashcards',
  'fill-the-gap': 'Fill the gap', build: 'Build the sentence', tones: 'Tones', 'spoken-or-written': 'Spoken or written?', review: 'Review',
};

function route() {
  const { parts, query } = parseHash();
  const [section = '', id] = parts;
  const views = {
    '': () => { const r = () => home(data, r); r(); return r; },
    grammar: () => {
      if (id) { const r = () => grammarDetail(data, id); r(); return r; }
      const r = () => grammarList(data, grammarLevel, (l) => { grammarLevel = l; r(); });
      r();
      return r;
    },
    vocabulary: () => { const r = () => (id ? vocabularyTopic(data, id) : vocabularyList(data)); r(); return r; },
    lookup: () => { const r = () => lookup(data, new URLSearchParams(location.hash.split('?')[1] ?? '').get('q') ?? ''); r(); return r; },
    flashcards: () => flashcards(data, query),
    'fill-the-gap': () => fillTheGap(data, query),
    build: () => buildTheSentence(data),
    tones: () => tones(data),
    'spoken-or-written': () => spokenOrWritten(data),
    review: () => review(data),
  };
  rerender = (views[section] ?? (() => { notFound(); return notFound; }))();
  document.title = `${TITLES[section] ?? 'Not found'} · CantonLink Community`;
  updateNav(section);
  document.getElementById('main').focus({ preventScroll: true });
  window.scrollTo(0, 0);
}

function updateNav(section) {
  for (const link of document.querySelectorAll('.site-nav a')) {
    const target = link.getAttribute('href').replace('#/', '');
    if (target === section) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }
  updateReviewCount();
}

function updateReviewCount() {
  const { toReview } = stats();
  document.getElementById('review-count').textContent = toReview ? ` (${toReview})` : '';
}
document.addEventListener('progresschange', updateReviewCount);

// Selecting the page you are already on starts it afresh.
document.addEventListener('click', (e) => {
  const link = e.target.closest('a[href^="#/"]');
  if (link && link.getAttribute('href') === location.hash) {
    e.preventDefault();
    route();
  }
});

function bindSettings() {
  const form = document.querySelector('.settings-panel');
  form.querySelector(`input[name="system"][value="${settings.system}"]`).checked = true;
  form.querySelector('input[name="showCjk"]').checked = settings.showCjk;
  form.addEventListener('change', (e) => {
    const { name, value, checked, type } = e.target;
    settings[name] = type === 'checkbox' ? checked : value;
    saveSettings();
    rerender();
  });
  document.addEventListener('click', (e) => {
    const details = document.querySelector('.settings');
    if (details.open && !details.contains(e.target)) details.open = false;
  });
}

document.addEventListener('keydown', (e) => {
  if (e.key !== ' ' || !location.hash.startsWith('#/flashcards')) return;
  if (['BUTTON', 'SELECT', 'INPUT', 'A', 'SUMMARY'].includes(document.activeElement?.tagName)) return;
  e.preventDefault();
  document.querySelector('.card')?.click();
});

async function main() {
  bindSettings();
  try {
    const response = await fetch('data.json');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    data = await response.json();
  } catch (error) {
    show(h('div', { class: 'panel' }, h('p', {}, `Sorry, the lessons could not be loaded (${error.message}). Please check your connection and refresh the page.`)));
    return;
  }
  window.addEventListener('hashchange', route);
  route();
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

main();
