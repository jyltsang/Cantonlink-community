const REPO = 'https://github.com/jyltsang/cantonlink-community';
const SESSION_LENGTH = { fillGap: 10, build: 8, spokenOrWritten: 10 };
const SYSTEM_LANG = { jyutping: 'yue-Latn', yale: 'yue-Latn', bopomofo: 'yue-Bopo' };
const SYSTEM_NAME = { jyutping: 'Jyutping', yale: 'Yale', bopomofo: 'Bopomofo' };

// --- Settings (remembered per browser; the site works without storage) ---

const DEFAULTS = { system: 'jyutping', showCjk: true };
function loadSettings() {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem('cantonlink-settings') ?? '{}') };
  } catch {
    return { ...DEFAULTS };
  }
}
function saveSettings() {
  try {
    localStorage.setItem('cantonlink-settings', JSON.stringify(settings));
  } catch {
    // Private browsing or blocked storage: settings last for this visit only.
  }
}
const settings = loadSettings();

// --- DOM helpers ----------------------------------------------------------

function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === false || value == null) continue;
    if (key.startsWith('on')) el.addEventListener(key.slice(2), value);
    else if (key === 'class') el.className = value;
    else el.setAttribute(key, value === true ? '' : value);
  }
  for (const child of children.flat()) if (child != null && child !== false) el.append(child);
  return el;
}

const app = document.getElementById('app');
function show(...nodes) {
  app.replaceChildren(...nodes);
}

const shuffle = (items) => {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};
const sample = (items, n) => shuffle(items).slice(0, n);

const reportUrl = (entry) => `${REPO}/issues/new?template=content-error.yml&title=${encodeURIComponent(`[Correction] ${entry}`)}`;
const patternUrl = (id) => `${REPO}/blob/main/library/grammar/${id}.md`;

function rom(word) {
  return h('span', { class: 'rom', lang: SYSTEM_LANG[settings.system] }, word[settings.system]);
}
function han(word) {
  return settings.showCjk ? h('span', { class: 'han', lang: 'yue-Hant-HK' }, word.cjk) : null;
}

function sentenceEl(tokens, { blankIndex = -1, filled = null } = {}) {
  return h('p', { class: 'sentence' }, tokens.map((t, i) => {
    if (t.punctuation) return h('span', { class: 'word punct' }, h('span', { class: 'rom' }, settings.system === 'bopomofo' ? t.cjk : t.punctuation));
    if (i === blankIndex) {
      const w = filled ?? { cjk: '＿＿', jyutping: ' ', yale: ' ', bopomofo: ' ' };
      return h('span', { class: 'word blank' }, rom(w), han(w));
    }
    return h('span', { class: 'word' }, rom(t), han(t));
  }));
}

function progressEl(done, total) {
  return h('div', { class: 'progress' },
    h('span', {}, `${Math.min(done + 1, total)} / ${total}`),
    h('div', { class: 'progress-bar', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': total, 'aria-valuenow': done },
      h('span', { style: `width:${(done / total) * 100}%` })));
}

function toolbar(...extra) {
  return h('div', { class: 'toolbar' }, h('a', { class: 'back', href: '#/' }, '← All practice'), ...extra);
}

function chips(options, current, onPick, label) {
  return h('div', { class: 'chip-row', role: 'group', 'aria-label': label },
    options.map(([value, text]) => h('button', { class: 'chip', type: 'button', 'aria-pressed': String(value === current), onclick: () => onPick(value) }, text)));
}

function scoreScreen(title, correct, total, onRestart, missedCount, onRetryMissed) {
  return h('div', { class: 'panel score' },
    h('h2', {}, title),
    h('p', { class: 'big' }, `${correct} / ${total}`),
    h('p', {}, correct === total ? '好叻呀！Excellent work.' : correct >= total / 2 ? '唔錯！Not bad — keep going.' : '慢慢嚟。Take it slowly — practice makes perfect.'),
    h('div', { class: 'actions', style: 'justify-content:center' },
      missedCount ? h('button', { class: 'btn btn-primary', type: 'button', onclick: onRetryMissed }, `Practise the ${missedCount} I missed`) : null,
      h('button', { class: missedCount ? 'btn' : 'btn btn-primary', type: 'button', onclick: onRestart }, 'New session'),
      h('a', { class: 'btn', href: '#/' }, 'Choose another exercise')));
}

const reportLine = (entry) => h('p', { class: 'report' }, 'Something unnatural? ', h('a', { href: reportUrl(entry), target: '_blank', rel: 'noopener' }, 'Report it'));

// --- Views ----------------------------------------------------------------

let data;
let rerender = () => {};

function home() {
  const draftCount = [...data.grammar, ...data.vocabulary].filter((x) => x.review.status !== 'reviewed').length;
  const total = data.grammar.length + data.vocabulary.length;
  const modes = [
    ['#/flashcards', '詞彙', 'Flashcards', `${data.vocabulary.reduce((n, t) => n + t.words.length, 0)} words in ${data.vocabulary.length} everyday topics.`],
    ['#/fill-the-gap', '填充', 'Fill the gap', 'Pick the grammar word that matches the meaning.'],
    ['#/build', '砌句', 'Build the sentence', 'Put the words in natural Cantonese order.'],
    ['#/spoken-or-written', '口語定書面語', 'Spoken or written?', 'Tell real spoken Cantonese from written Chinese.'],
  ];
  rerender = home;
  show(
    h('h1', {}, '練習廣東話 · Practise Cantonese'),
    h('p', { class: 'lede' }, `Free drills, currently shown in ${SYSTEM_NAME[settings.system]}. Switch between Jyutping, Yale and Bopomofo under “Display”. No account needed.`),
    draftCount ? h('p', { class: 'notice' }, h('span', { 'aria-hidden': 'true' }, '⚠️'),
      h('span', {}, `${draftCount} of ${total} grammar patterns and word lists are still awaiting review by native speakers. `,
        h('a', { href: `${REPO}/blob/main/library/review-status.md` }, 'See review status'), ' or ',
        h('a', { href: `${REPO}/issues/new?template=reviewer.yml` }, 'help review'), '.')) : null,
    h('nav', { class: 'modes', 'aria-label': 'Exercises' }, modes.map(([href, cjk, title, text]) =>
      h('a', { class: 'mode-card', href }, h('span', { class: 'mode-cjk', lang: 'yue-Hant-HK' }, cjk), h('h2', {}, title), h('p', {}, text)))),
    h('div', { class: 'links' },
      h('h2', {}, 'Learn first'),
      h('ul', {},
        h('li', {}, h('a', { href: `${REPO}/blob/main/library/grammar/README.md` }, `Grammar patterns`), ` — ${data.grammar.length} patterns with examples`),
        h('li', {}, h('a', { href: `${REPO}/blob/main/library/english-index.md` }, 'English → Cantonese index')),
        h('li', {}, h('a', { href: `${REPO}/blob/main/library/romanisation.md` }, 'Romanisation guide'), ' — the six tones'))),
  );
}

function flashcards() {
  let topicId = data.vocabulary[0].id;
  let direction = 'canto-en';
  let queue;
  let total;
  let flipped;

  const start = () => {
    const topic = data.vocabulary.find((t) => t.id === topicId);
    queue = shuffle(topic.words);
    total = queue.length;
    flipped = false;
    render();
  };

  const answer = (known) => {
    const card = queue.shift();
    if (!known) queue.push(card);
    flipped = false;
    render();
  };

  const render = () => {
    const topic = data.vocabulary.find((t) => t.id === topicId);
    const head = [
      toolbar(
        h('select', { class: 'chip', 'aria-label': 'Topic', onchange: (e) => { topicId = e.target.value; start(); } },
          data.vocabulary.map((t) => h('option', { value: t.id, selected: t.id === topicId }, `${t.title} · ${t.titleCjk}`)))),
      chips([['canto-en', 'Cantonese → English'], ['en-canto', 'English → Cantonese']], direction, (d) => { direction = d; start(); }, 'Direction'),
    ];
    if (!queue.length) {
      show(h('h1', {}, 'Flashcards'), ...head, h('div', { class: 'panel score' },
        h('h2', {}, `${topic.title} done!`), h('p', {}, `You worked through all ${total} words.`),
        h('div', { class: 'actions', style: 'justify-content:center' },
          h('button', { class: 'btn btn-primary', type: 'button', onclick: start }, 'Go again'),
          h('a', { class: 'btn', href: '#/' }, 'Choose another exercise'))));
      return;
    }
    const w = queue[0];
    const cantoFace = [h('span', { class: 'big', lang: SYSTEM_LANG[settings.system] }, w[settings.system]), settings.showCjk ? h('span', { class: 'han-big', lang: 'yue-Hant-HK' }, w.cjk) : null];
    const enFace = [h('span', { class: 'big' }, w.en), h('span', { class: 'meta' }, w.pos)];
    const front = direction === 'canto-en' ? cantoFace : enFace;
    const back = direction === 'canto-en' ? enFace : cantoFace;
    const extras = flipped ? [
      w.classifier ? h('span', { class: 'meta' }, 'Classifier: ', h('span', { lang: 'yue-Hant-HK' }, w.classifier.cjk), ` ${w.classifier[settings.system]}`) : null,
      w.note ? h('span', { class: 'meta' }, w.note) : null,
    ] : [h('span', { class: 'hint' }, 'Tap or press Space to turn over')];
    show(
      h('h1', {}, 'Flashcards'), ...head,
      h('div', { class: 'progress' }, h('span', {}, `${total - queue.length} of ${total} learnt · ${queue.length} to go`)),
      h('button', { class: 'card', type: 'button', 'aria-label': flipped ? 'Card back' : 'Card front, press to turn over', onclick: () => { flipped = !flipped; render(); } },
        ...front, ...(flipped ? [h('hr', { class: 'divider', 'aria-hidden': 'true' }), ...back] : []), ...extras),
      flipped ? h('div', { class: 'actions' },
        h('button', { class: 'btn', type: 'button', onclick: () => answer(false) }, 'Again — show it later'),
        h('button', { class: 'btn btn-primary', type: 'button', onclick: () => answer(true) }, 'Got it')) : null,
      reportLine(`vocabulary/${topicId}: ${w.cjk}`),
    );
    app.querySelector(flipped ? '.btn-primary' : '.card')?.focus();
  };

  rerender = render;
  start();
}

function fillTheGap() {
  let level = 'A1';
  let items;
  let index;
  let correct;
  let missed;
  let chosen;

  const start = (pool) => {
    items = pool ?? sample(data.practice.fillGap.filter((q) => level === 'all' || q.level === level), SESSION_LENGTH.fillGap);
    index = 0; correct = 0; missed = []; chosen = null;
    render();
  };

  const choose = (option) => {
    chosen = option;
    const q = items[index];
    if (option.cjk === q.options[0].cjk) correct++;
    else missed.push(q);
    render();
  };

  const render = () => {
    const head = [h('h1', {}, 'Fill the gap'), toolbar(chips([['A1', 'A1'], ['A2', 'A2'], ['all', 'All levels']], level, (l) => { level = l; start(); }, 'Level'))];
    if (index >= items.length) {
      show(...head, scoreScreen('Session complete', correct, items.length, () => start(), missed.length, () => start(shuffle(missed))));
      return;
    }
    const q = items[index];
    q.shuffled ??= shuffle(q.options);
    const answer = q.options[0];
    const pattern = data.grammar.find((p) => p.id === q.patternId);
    show(
      ...head,
      progressEl(index, items.length),
      h('div', { class: 'panel' },
        h('p', { class: 'prompt-en' }, `“${q.en}”`),
        sentenceEl(q.tokens, { blankIndex: q.gapIndex, filled: chosen ? answer : null }),
        h('div', { class: 'options', role: 'group', 'aria-label': 'Choose the missing word' }, q.shuffled.map((o) => {
          const state = !chosen ? '' : o.cjk === answer.cjk ? ' correct' : o === chosen ? ' wrong' : '';
          return h('button', { class: `option${state}`, type: 'button', disabled: Boolean(chosen), onclick: () => choose(o) }, rom(o), han(o));
        })),
        chosen ? h('div', { role: 'status', class: `feedback ${chosen.cjk === answer.cjk ? 'good' : 'bad'}` },
          h('p', {}, h('strong', {}, chosen.cjk === answer.cjk ? '✓ Correct!' : `✗ The answer is ${answer.cjk} ${answer[settings.system]}.`)),
          h('p', { class: 'small' }, 'Pattern: ', h('a', { href: patternUrl(pattern.id), target: '_blank', rel: 'noopener' }, pattern.pattern), ` — ${pattern.meaning}`),
          h('div', { class: 'actions' }, h('button', { class: 'btn btn-primary', type: 'button', onclick: () => { index++; chosen = null; render(); } }, index + 1 < items.length ? 'Next' : 'See score'))) : null,
        reportLine(`grammar/${q.patternId}`)),
    );
    if (chosen) app.querySelector('.feedback .btn-primary')?.focus();
  };

  rerender = render;
  start();
}

function buildTheSentence() {
  let level = 'A1';
  let items;
  let index;
  let correct;
  let missed;
  let placed;
  let pool;
  let checked;

  const words = (q) => q.tokens.filter((t) => !t.punctuation);
  const setUp = () => {
    const ws = words(items[index]).map((w, i) => ({ ...w, key: i }));
    let mixed = shuffle(ws);
    if (mixed.every((w, i) => w.key === i)) mixed = [...mixed.slice(1), mixed[0]];
    pool = mixed; placed = []; checked = null;
  };
  const start = (list) => {
    items = list ?? sample(data.practice.buildSentence.filter((q) => level === 'all' || q.level === level), SESSION_LENGTH.build);
    index = 0; correct = 0; missed = [];
    setUp();
    render();
  };
  const move = (tile, from, to) => {
    if (checked) return;
    from.splice(from.indexOf(tile), 1);
    to.push(tile);
    render();
  };
  const check = () => {
    const target = words(items[index]).map((w) => w.cjk).join('|');
    checked = placed.map((w) => w.cjk).join('|') === target ? 'good' : 'bad';
    if (checked === 'good') correct++;
    else missed.push(items[index]);
    render();
  };
  const tileEl = (w, onclick) => h('button', { class: 'tile', type: 'button', onclick }, rom(w), han(w));

  const render = () => {
    const head = [h('h1', {}, 'Build the sentence'), toolbar(chips([['A1', 'A1'], ['A2', 'A2'], ['all', 'All levels']], level, (l) => { level = l; start(); }, 'Level'))];
    if (index >= items.length) {
      show(...head, scoreScreen('Session complete', correct, items.length, () => start(), missed.length, () => start(shuffle(missed))));
      return;
    }
    const q = items[index];
    const pattern = data.grammar.find((p) => p.id === q.patternId);
    show(
      ...head,
      progressEl(index, items.length),
      h('div', { class: 'panel' },
        h('p', { class: 'prompt-en' }, `“${q.en}”`),
        h('div', { class: 'tiles answer', role: 'group', 'aria-label': 'Your sentence (tap a word to remove it)' }, placed.map((w) => tileEl(w, () => move(w, placed, pool)))),
        h('div', { class: 'tiles', role: 'group', 'aria-label': 'Available words' }, pool.map((w) => tileEl(w, () => move(w, pool, placed)))),
        !checked ? h('div', { class: 'actions' },
          h('button', { class: 'btn btn-primary', type: 'button', disabled: pool.length > 0, onclick: check }, 'Check'),
          h('button', { class: 'btn', type: 'button', onclick: () => { pool = [...pool, ...placed]; placed = []; render(); } }, 'Clear')) : null,
        checked ? h('div', { role: 'status', class: `feedback ${checked}` },
          h('p', {}, h('strong', {}, checked === 'good' ? '✓ Correct!' : '✗ Not quite. The library’s sentence is:')),
          sentenceEl(q.tokens),
          checked === 'bad' ? h('p', { class: 'small' }, 'Cantonese word order is sometimes flexible; if yours sounds natural to a native speaker, it may be fine too.') : null,
          h('p', { class: 'small' }, 'Pattern: ', h('a', { href: patternUrl(pattern.id), target: '_blank', rel: 'noopener' }, pattern.pattern), ` — ${pattern.meaning}`),
          h('div', { class: 'actions' }, h('button', { class: 'btn btn-primary', type: 'button', onclick: () => { index++; if (index < items.length) setUp(); render(); } }, index + 1 < items.length ? 'Next' : 'See score'))) : null,
        reportLine(`grammar/${q.patternId}`)),
    );
    if (checked) app.querySelector('.feedback .btn-primary')?.focus();
  };

  rerender = render;
  start();
}

function spokenOrWritten() {
  let items;
  let index;
  let correct;
  let missed;
  let picked;
  const all = data.practice.spokenOrWritten.items.flatMap((item) => [
    { text: item.written, kind: 'written', item },
    { text: item.spoken.cjk, kind: 'spoken', item },
  ]);

  const start = (list) => {
    items = list ?? sample(all, SESSION_LENGTH.spokenOrWritten);
    index = 0; correct = 0; missed = []; picked = null;
    render();
  };
  const pick = (kind) => {
    picked = kind;
    if (kind === items[index].kind) correct++;
    else missed.push(items[index]);
    render();
  };

  const render = () => {
    const head = [h('h1', {}, 'Spoken or written?'), toolbar()];
    if (index >= items.length) {
      show(...head, scoreScreen('Session complete', correct, items.length, () => start(), missed.length, () => start(shuffle(missed))));
      return;
    }
    const q = items[index];
    const s = q.item.spoken;
    show(
      ...head,
      h('p', { class: 'lede' }, 'Is this how people actually speak Cantonese, or is it Standard Written Chinese? This drill uses characters, because written Chinese has no Cantonese romanisation of its own.'),
      progressEl(index, items.length),
      h('div', { class: 'panel' },
        h('p', { class: 'han-big cjk', lang: 'yue-Hant-HK', style: 'font-size:28px;margin:0 0 16px' }, q.text),
        h('div', { class: 'options' },
          ['spoken', 'written'].map((kind) => {
            const state = !picked ? '' : kind === q.kind ? ' correct' : kind === picked ? ' wrong' : '';
            return h('button', { class: `option${state}`, type: 'button', disabled: Boolean(picked), onclick: () => pick(kind) },
              h('span', { class: 'rom' }, kind === 'spoken' ? 'Spoken Cantonese' : 'Written Chinese'), h('span', { class: 'han', lang: 'yue-Hant-HK' }, kind === 'spoken' ? '口語' : '書面語'));
          })),
        picked ? h('div', { role: 'status', class: `feedback ${picked === q.kind ? 'good' : 'bad'}` },
          h('p', {}, h('strong', {}, picked === q.kind ? '✓ Correct!' : `✗ It’s ${q.kind === 'spoken' ? 'spoken Cantonese' : 'written Chinese'}.`)),
          h('p', { class: 'small' }, `Written: `, h('span', { lang: 'yue-Hant-HK' }, q.item.written), ` → Spoken: `),
          h('p', {}, h('span', { class: 'cjk', lang: 'yue-Hant-HK', style: 'font-size:20px' }, s.cjk), ' ', h('span', { lang: SYSTEM_LANG[settings.system] }, s[settings.system])),
          h('p', { class: 'small' }, `“${s.en}”`),
          h('p', { class: 'small' }, `What changes: ${q.item.changes}`),
          h('div', { class: 'actions' }, h('button', { class: 'btn btn-primary', type: 'button', onclick: () => { index++; picked = null; render(); } }, index + 1 < items.length ? 'Next' : 'See score'))) : null,
        reportLine('practice/spoken-or-written')),
    );
    if (picked) app.querySelector('.feedback .btn-primary')?.focus();
  };

  rerender = render;
  start();
}

// --- Routing and settings -------------------------------------------------

const ROUTES = { '': home, flashcards, 'fill-the-gap': fillTheGap, build: buildTheSentence, 'spoken-or-written': spokenOrWritten };
function route() {
  const name = location.hash.replace(/^#\/?/, '');
  (ROUTES[name] ?? home)();
  document.getElementById('main').focus({ preventScroll: true });
  window.scrollTo(0, 0);
}

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
}

document.addEventListener('keydown', (e) => {
  if (e.key === ' ' && document.activeElement?.classList.contains('card')) return;
  if (e.key === ' ' && location.hash === '#/flashcards' && !['BUTTON', 'SELECT', 'INPUT'].includes(document.activeElement?.tagName)) {
    e.preventDefault();
    app.querySelector('.card')?.click();
  }
});

async function main() {
  bindSettings();
  try {
    const response = await fetch('data.json');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    data = await response.json();
  } catch (error) {
    show(h('p', { class: 'panel' }, `Sorry, the practice data could not be loaded (${error.message}). Please refresh the page.`));
    return;
  }
  window.addEventListener('hashchange', route);
  route();
}

main();
