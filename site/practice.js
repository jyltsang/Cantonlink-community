import { parseSyllable, toYale, toBopomofo, romanise } from './romanise.js';
import {
  SYSTEM_LANG, settings, h, show, app, shuffle, sample, rom, han, sentenceEl, sentenceText, pageHead, chips,
  reportLine, recordAnswer, reviewKeys, savedPhrase, stats, whenDue,
} from './lib.js';
import { aiReady } from './ai-settings.js';

const SESSION_LENGTH = 10;
const patternLink = (data, id) => {
  const p = data.grammar.find((x) => x.id === id);
  return h('p', { class: 'small' }, 'Pattern: ', h('a', { href: `#/grammar/${p.id}`, lang: 'yue-Hant-HK' }, p.pattern), ` — ${p.meaning}`);
};
const verdict = (correct, wrongText) => h('p', {}, h('strong', {}, correct ? 'Correct.' : wrongText));

// --- Question types -------------------------------------------------------
// Each type renders one question. `st` holds that question's state; calling
// `answer(isCorrect)` records the result and shows the feedback.

const KINDS = {
  fill: {
    entry: (q) => `grammar/${q.patternId}`,
    key: (q) => `fill:${q.id}`,
    render(q, st, answer, data) {
      st.options ??= shuffle(q.options);
      const right = q.options[0];
      return [
        h('p', { class: 'prompt-en' }, `“${q.en}”`),
        sentenceEl(q.tokens, { blankIndex: q.gapIndex, filled: st.done ? right : null }),
        h('div', { class: 'options', role: 'group', 'aria-label': 'Choose the missing word' }, st.options.map((o, i) => {
          const state = !st.done ? '' : o === right ? ' correct' : o === st.choice ? ' wrong' : '';
          return h('button', { class: `option${state}`, type: 'button', disabled: st.done, 'data-key': i + 1, onclick: () => { st.choice = o; answer(o === right); } },
            h('span', { class: 'key-hint', 'aria-hidden': 'true' }, i + 1), rom(o), han(o));
        })),
        st.done ? h('div', { class: `feedback ${st.correct ? 'good' : 'bad'}`, role: 'status' },
          verdict(st.correct, `The answer is ${right.cjk} ${right[settings.system]}.`), patternLink(data, q.patternId),
          aiReady() ? h('p', { class: 'small' }, h('a', { href: `#/tutor?ask=${encodeURIComponent(`Why is ${right.cjk} (${right.jyutping}) right in "${q.tokens.map((t) => t.cjk).join('')}" (${q.en})${st.choice !== right ? `, and not ${st.choice.cjk}` : ''}?`)}` }, 'Ask the AI tutor why')) : null) : null,
      ];
    },
  },

  build: {
    entry: (q) => `grammar/${q.patternId}`,
    key: (q) => `build:${q.id}`,
    render(q, st, answer, data, rerender) {
      const words = q.tokens.filter((t) => !t.punctuation);
      if (!st.pool) {
        const keyed = words.map((w, i) => ({ ...w, key: i }));
        let mixed = shuffle(keyed);
        if (mixed.every((w, i) => w.key === i)) mixed = [...mixed.slice(1), mixed[0]];
        st.pool = mixed;
        st.placed = [];
      }
      const move = (tile, from, to) => {
        if (st.done) return;
        from.splice(from.indexOf(tile), 1);
        to.push(tile);
        rerender();
      };
      const tile = (w, onclick) => h('button', { class: 'tile', type: 'button', onclick }, rom(w), han(w));
      return [
        h('p', { class: 'prompt-en' }, `“${q.en}”`),
        h('div', { class: 'tiles answer', role: 'group', 'aria-label': 'Your sentence. Select a word to remove it.' },
          st.placed.length ? st.placed.map((w) => tile(w, () => move(w, st.placed, st.pool))) : h('span', { class: 'tiles-hint' }, 'Select the words in order')),
        h('div', { class: 'tiles', role: 'group', 'aria-label': 'Words to use' }, st.pool.map((w) => tile(w, () => move(w, st.pool, st.placed)))),
        !st.done ? h('div', { class: 'actions' },
          h('button', { class: 'btn btn-primary', type: 'button', disabled: st.pool.length > 0, onclick: () => answer(st.placed.map((w) => w.cjk).join('|') === words.map((w) => w.cjk).join('|')) }, 'Check'),
          h('button', { class: 'btn', type: 'button', onclick: () => { st.pool.push(...st.placed); st.placed = []; rerender(); } }, 'Start again')) : null,
        st.done ? h('div', { class: `feedback ${st.correct ? 'good' : 'bad'}`, role: 'status' },
          verdict(st.correct, 'Not quite. The sentence in the library is:'),
          sentenceEl(q.tokens),
          st.correct ? null : h('p', { class: 'small' }, 'Word order is sometimes flexible. If yours would sound natural to a native speaker, it may be fine too.'),
          patternLink(data, q.patternId)) : null,
      ];
    },
  },

  tone: {
    entry: (q) => `vocabulary/${q.topic}: ${q.word.cjk}`,
    key: (q) => `tone:${q.word.cjk}:${q.index}`,
    render(q, st, answer) {
      const right = q.options.find((o) => o.right);
      return [
        h('p', { class: 'prompt-en' }, `How do you say “${q.word.en}”?`),
        settings.showCjk ? h('p', { class: 'prompt-cjk', lang: 'yue-Hant-HK' }, q.word.cjk) : null,
        q.syllables > 1 ? h('p', { class: 'small' }, `The options differ only in syllable ${q.index + 1} of ${q.syllables}.`) : null,
        h('div', { class: 'options', role: 'group', 'aria-label': 'Choose the correct tones' }, q.options.map((o, i) => {
          const state = !st.done ? '' : o.right ? ' correct' : o === st.choice ? ' wrong' : '';
          return h('button', { class: `option${state}`, type: 'button', disabled: st.done, 'data-key': i + 1, onclick: () => { st.choice = o; answer(o.right); } },
            h('span', { class: 'key-hint', 'aria-hidden': 'true' }, i + 1), rom(o));
        })),
        st.done ? h('div', { class: `feedback ${st.correct ? 'good' : 'bad'}`, role: 'status' },
          verdict(st.correct, `It's ${right[settings.system]}.`),
          h('p', { class: 'small' }, `Tone ${q.tone}: ${TONE_NAMES[q.tone]}.`)) : null,
      ];
    },
  },

  sow: {
    entry: () => 'practice/spoken-or-written',
    key: (q) => `sow:${q.n}:${q.kind}`,
    render(q, st, answer) {
      const s = q.item.spoken;
      return [
        h('p', { class: 'prompt-cjk', lang: 'yue-Hant-HK' }, q.text),
        h('div', { class: 'options two' }, ['spoken', 'written'].map((kind, i) => {
          const state = !st.done ? '' : kind === q.kind ? ' correct' : kind === st.choice ? ' wrong' : '';
          return h('button', { class: `option${state}`, type: 'button', disabled: st.done, 'data-key': i + 1, onclick: () => { st.choice = kind; answer(kind === q.kind); } },
            h('span', { class: 'key-hint', 'aria-hidden': 'true' }, i + 1),
            h('span', { class: 'rom' }, kind === 'spoken' ? 'Spoken Cantonese' : 'Written Chinese'),
            h('span', { class: 'han', lang: 'yue-Hant-HK' }, kind === 'spoken' ? '口語' : '書面語'));
        })),
        st.done ? h('div', { class: `feedback ${st.correct ? 'good' : 'bad'}`, role: 'status' },
          verdict(st.correct, `It's ${q.kind === 'spoken' ? 'spoken Cantonese' : 'written Chinese'}.`),
          h('p', { class: 'small' }, 'Written: ', h('span', { lang: 'yue-Hant-HK' }, q.item.written)),
          h('p', {}, 'Spoken: ', sentenceText(s)),
          h('p', { class: 'small' }, `“${s.en}” · What changes: ${q.item.changes}`)) : null,
      ];
    },
  },

  phrase: {
    entry: (q) => `AI tutor phrase: ${q.cjk}`,
    key: (q) => `phrase:${q.cjk}`,
    render(q, st, answer) {
      return [
        h('p', { class: 'msg-label' }, 'Saved from the AI tutor'),
        sentenceEl(q.tokens),
        st.revealed ? h('p', { class: 'en' }, q.en) : null,
        !st.revealed ? h('div', { class: 'actions' }, h('button', { class: 'btn btn-primary', type: 'button', onclick: () => { st.revealed = true; answer.rerender(); } }, 'Show meaning'))
          : !st.done ? h('div', { class: 'actions' },
            h('button', { class: 'btn', type: 'button', onclick: () => answer(false) }, 'I didn’t know it'),
            h('button', { class: 'btn btn-primary', type: 'button', onclick: () => answer(true) }, 'I knew it')) : null,
      ];
    },
  },

  card: {
    entry: (q) => `vocabulary/${q.topic}: ${q.word.cjk}`,
    key: (q) => `card:${q.topic}:${q.word.cjk}`,
    render(q, st, answer) {
      const w = q.word;
      return [
        h('div', { class: 'card static' },
          h('span', { class: 'big', lang: SYSTEM_LANG[settings.system] }, w[settings.system]),
          settings.showCjk ? h('span', { class: 'han-big', lang: 'yue-Hant-HK' }, w.cjk) : null,
          st.revealed ? [h('hr', { class: 'divider', 'aria-hidden': 'true' }), h('span', { class: 'big' }, w.en)] : null),
        !st.revealed ? h('div', { class: 'actions' }, h('button', { class: 'btn btn-primary', type: 'button', onclick: () => { st.revealed = true; answer.rerender(); } }, 'Show meaning'))
          : !st.done ? h('div', { class: 'actions' },
            h('button', { class: 'btn', type: 'button', onclick: () => answer(false) }, 'I didn’t know it'),
            h('button', { class: 'btn btn-primary', type: 'button', onclick: () => answer(true) }, 'I knew it')) : null,
      ];
    },
  },
};

// --- Session runner -------------------------------------------------------

function runSession(data, { title, lede, back, filters, makeItems, reviewing = false, emptyText }) {
  let items;
  let index;
  let correct;
  let missed;
  let st;

  const start = (list) => {
    items = list ?? makeItems();
    index = 0; correct = 0; missed = []; st = {};
    render();
  };

  const answer = (isCorrect) => {
    const item = items[index];
    st.done = true;
    st.correct = isCorrect;
    if (isCorrect) correct++;
    else missed.push(item);
    recordAnswer(KINDS[item.kind].key(item.q), isCorrect, { reviewing });
    render();
    app.querySelector('.next')?.focus();
  };
  answer.rerender = () => render();

  const next = () => {
    index++;
    st = {};
    render();
    app.querySelector('.option, .tile, .card, .btn-primary')?.focus();
  };

  const render = () => {
    const head = [...pageHead(title, { lede, back }), filters ? filters(start) : null];
    if (!items.length) {
      show(...head, h('div', { class: 'panel' }, h('p', {}, emptyText ?? 'There are no questions here yet.'), h('a', { class: 'btn', href: '#/' }, 'Home')));
      return;
    }
    if (index >= items.length) {
      const total = items.length;
      show(...head, h('div', { class: 'panel score' },
        h('h2', {}, 'Session complete'),
        h('p', { class: 'big' }, `${correct} / ${total}`),
        h('p', {}, correct === total ? '好叻呀！ Excellent work.' : correct >= total / 2 ? '唔錯！ Not bad — keep going.' : '慢慢嚟。 Take it slowly; it will come.'),
        missed.length ? h('p', { class: 'small' }, `${missed.length} missed question${missed.length === 1 ? '' : 's'} saved for review.`) : null,
        h('div', { class: 'actions center' },
          missed.length ? h('button', { class: 'btn btn-primary', type: 'button', onclick: () => start(shuffle(missed)) }, `Retry the ${missed.length} I missed`) : null,
          h('button', { class: missed.length ? 'btn' : 'btn btn-primary', type: 'button', onclick: () => start() }, reviewing ? 'Review again' : 'New session'),
          h('a', { class: 'btn', href: '#/' }, 'Home'))));
      app.querySelector('.score .btn')?.focus();
      return;
    }
    const item = items[index];
    show(
      ...head,
      h('div', { class: 'progress' },
        h('span', {}, `${index + 1} of ${items.length}`),
        h('div', { class: 'progress-bar', role: 'progressbar', 'aria-label': 'Session progress', 'aria-valuemin': 0, 'aria-valuemax': items.length, 'aria-valuenow': index },
          h('span', { style: `width:${(index / items.length) * 100}%` }))),
      h('div', { class: 'panel question' },
        ...KINDS[item.kind].render(item.q, st, answer, data, render),
        st.done ? h('div', { class: 'actions' }, h('button', { class: 'btn btn-primary next', type: 'button', onclick: next }, index + 1 < items.length ? 'Next' : 'See results')) : null,
        reportLine(KINDS[item.kind].entry(item.q))),
    );
  };

  start();
  return render;
}

// Number keys choose an option; Enter moves on once answered.
document.addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey || ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;
  const button = app.querySelector(`.question .option[data-key="${e.key}"]:not(:disabled)`);
  if (button) {
    e.preventDefault();
    button.click();
  }
});

// --- Item builders --------------------------------------------------------

const levelFilter = (level, setLevel) => chips([['A1', 'A1'], ['A2', 'A2'], ['B1', 'B1'], ['all', 'All levels']], level, setLevel, 'Level');
const byLevel = (list, level) => list.filter((q) => level === 'all' || q.level === level);

const TONE_NAMES = { 1: 'high level', 2: 'mid rising', 3: 'mid level', 4: 'low falling', 5: 'low rising', 6: 'low level' };

function toneQuestion(word, topic, index = null) {
  const syllables = word.jyutping.split(' ');
  const candidates = syllables.map((s, i) => ({ i, alts: [1, 2, 3, 4, 5, 6].map((t) => s.replace(/\d$/, t)).filter((v) => v !== s && parseSyllable(v)) })).filter((c) => c.alts.length >= 3);
  const pick = index == null ? candidates[Math.floor(Math.random() * candidates.length)] : candidates.find((c) => c.i === index);
  if (!pick) return null;
  const variant = (syl) => {
    const jp = syllables.map((s, i) => (i === pick.i ? syl : s)).join(' ');
    return { jyutping: jp, yale: jp.split(' ').map(toYale).join(' '), bopomofo: jp.split(' ').map(toBopomofo).join(' ') };
  };
  const options = shuffle([{ ...variant(syllables[pick.i]), right: true }, ...sample(pick.alts, 3).map((a) => variant(a))]);
  return { word, topic, index: pick.i, syllables: syllables.length, tone: Number(syllables[pick.i].at(-1)), options };
}

const allWords = (data) => data.vocabulary.flatMap((t) => t.words.map((word) => ({ word, topic: t.id })));
const sowPool = (data) => data.practice.spokenOrWritten.items.flatMap((item, n) => [
  { text: item.written, kind: 'written', item, n },
  { text: item.spoken.cjk, kind: 'spoken', item, n },
]);

// --- Views ----------------------------------------------------------------

export function fillTheGap(data, query) {
  const pattern = query.get('pattern');
  let level = 'A1';
  const p = pattern && data.grammar.find((x) => x.id === pattern);
  return runSession(data, {
    title: 'Fill the gap',
    lede: p ? `Practising ${p.pattern}: ${p.meaning}.` : 'Choose the word that completes the sentence so that it matches the English. Number keys 1 to 4 also work.',
    back: p ? [`#/grammar/${p.id}`, p.pattern] : ['#/', 'Home'],
    filters: p ? null : (restart) => levelFilter(level, (l) => { level = l; restart(); }),
    makeItems: () => (p
      ? shuffle(data.practice.fillGap.filter((q) => q.patternId === p.id))
      : sample(byLevel(data.practice.fillGap, level), SESSION_LENGTH)).map((q) => ({ kind: 'fill', q })),
  });
}

export function buildTheSentence(data) {
  let level = 'A1';
  return runSession(data, {
    title: 'Build the sentence',
    lede: 'Select the words in the right order to say the English sentence in Cantonese.',
    filters: (restart) => levelFilter(level, (l) => { level = l; restart(); }),
    makeItems: () => sample(byLevel(data.practice.buildSentence, level), 8).map((q) => ({ kind: 'build', q })),
  });
}

export function tones(data) {
  let topic = 'all';
  const words = allWords(data);
  return runSession(data, {
    title: 'Tones',
    lede: 'Cantonese has six tones, and a change of tone changes the meaning. Choose the spelling with the right tones.',
    filters: (restart) => h('div', {},
      h('select', { class: 'chip', 'aria-label': 'Topic', onchange: (e) => { topic = e.target.value; restart(); } },
        h('option', { value: 'all', selected: topic === 'all' }, 'All topics'),
        data.vocabulary.map((t) => h('option', { value: t.id, selected: t.id === topic }, `${t.title} · ${t.titleCjk}`))),
      toneTable()),
    makeItems: () => sample(words.filter((w) => topic === 'all' || w.topic === topic), 30)
      .map(({ word, topic: t }) => toneQuestion(word, t)).filter(Boolean).slice(0, SESSION_LENGTH).map((q) => ({ kind: 'tone', q })),
  });
}

function toneTable() {
  const rows = [[1, '詩', 'poem'], [2, '史', 'history'], [3, '試', 'to try'], [4, '時', 'time'], [5, '市', 'market'], [6, '事', 'matter']];
  return h('details', { class: 'tone-table' },
    h('summary', {}, 'The six tones'),
    h('table', {},
      h('thead', {}, h('tr', {}, ['Tone', 'Pitch', 'Example', 'Meaning'].map((t) => h('th', { scope: 'col' }, t)))),
      h('tbody', {}, rows.map(([t, cjk, en]) => h('tr', {},
        h('td', {}, String(t)), h('td', {}, TONE_NAMES[t]),
        h('td', {}, h('span', { lang: 'yue-Hant-HK' }, cjk), ' ', h('span', { lang: SYSTEM_LANG[settings.system] }, romanise(`si${t}`)[settings.system])),
        h('td', {}, en))))));
}

export function spokenOrWritten(data) {
  return runSession(data, {
    title: 'Spoken or written?',
    lede: 'Is this how people actually speak, or Standard Written Chinese? This drill uses characters, because written Chinese has no Cantonese romanisation of its own.',
    makeItems: () => sample(sowPool(data), SESSION_LENGTH).map((q) => ({ kind: 'sow', q })),
  });
}

export function review(data) {
  const resolve = (key) => {
    const [kind, ...rest] = key.split(':');
    if (kind === 'fill') return data.practice.fillGap.find((q) => q.id === rest.join(':')) && { kind, q: data.practice.fillGap.find((q) => q.id === rest.join(':')) };
    if (kind === 'build') return data.practice.buildSentence.find((q) => q.id === rest.join(':')) && { kind, q: data.practice.buildSentence.find((q) => q.id === rest.join(':')) };
    if (kind === 'phrase') {
      const q = savedPhrase(rest.join(':'));
      return q && { kind, q };
    }
    if (kind === 'sow') {
      const q = sowPool(data).find((x) => x.n === Number(rest[0]) && x.kind === rest[1]);
      return q && { kind, q };
    }
    const found = allWords(data).find((w) => w.word.cjk === (kind === 'tone' ? rest[0] : rest[1]) && (kind === 'tone' || w.topic === rest[0]));
    if (!found) return null;
    if (kind === 'card') return { kind, q: found };
    const q = toneQuestion(found.word, found.topic, Number(rest[1]));
    return q && { kind, q };
  };
  return runSession(data, {
    title: 'Review',
    lede: 'Questions you missed, brought back on a spaced schedule. Each correct answer waits longer before the next review: 1, 3, 7, then 14 days, after which the item is learnt. A miss starts it again.',
    reviewing: true,
    emptyText: reviewEmptyText(),
    makeItems: () => shuffle(reviewKeys().map(resolve).filter(Boolean)).slice(0, 20),
  });
}

function reviewEmptyText() {
  const { scheduled, nextDue } = stats();
  if (!scheduled) return 'Nothing to review. Questions you miss in any exercise will appear here.';
  return `Nothing due right now. ${scheduled} item${scheduled === 1 ? ' is' : 's are'} scheduled; the next is due ${whenDue(nextDue)}.`;
}

// --- Flashcards -----------------------------------------------------------

export function flashcards(data, query) {
  let topicId = data.vocabulary.some((t) => t.id === query.get('topic')) ? query.get('topic') : data.vocabulary[0].id;
  let direction = 'canto-en';
  let queue;
  let total;
  let flipped;

  const start = () => {
    queue = shuffle(data.vocabulary.find((t) => t.id === topicId).words);
    total = queue.length;
    flipped = false;
    render();
  };

  const rate = (known) => {
    const card = queue.shift();
    recordAnswer(`card:${topicId}:${card.cjk}`, known, { reviewing: true });
    if (!known) queue.push(card);
    flipped = false;
    render();
  };

  const render = () => {
    const topic = data.vocabulary.find((t) => t.id === topicId);
    const head = [
      ...pageHead('Flashcards', { lede: 'Turn the card over, then say whether you knew it. Cards you miss come back later in the session and are saved for review.' }),
      h('div', { class: 'toolbar' },
        h('select', { class: 'chip', 'aria-label': 'Topic', onchange: (e) => { topicId = e.target.value; start(); } },
          data.vocabulary.map((t) => h('option', { value: t.id, selected: t.id === topicId }, `${t.title} · ${t.titleCjk}`))),
        chips([['canto-en', 'Cantonese first'], ['en-canto', 'English first']], direction, (d) => { direction = d; start(); }, 'Direction')),
    ];
    if (!queue.length) {
      show(...head, h('div', { class: 'panel score' },
        h('h2', {}, `${topic.title}: done`), h('p', {}, `You worked through all ${total} words.`),
        h('div', { class: 'actions center' },
          h('button', { class: 'btn btn-primary', type: 'button', onclick: start }, 'Go again'),
          h('a', { class: 'btn', href: `#/vocabulary/${topic.id}` }, 'See the word list'))));
      return;
    }
    const w = queue[0];
    const canto = [h('span', { class: 'big', lang: SYSTEM_LANG[settings.system] }, w[settings.system]), settings.showCjk ? h('span', { class: 'han-big', lang: 'yue-Hant-HK' }, w.cjk) : null];
    const en = [h('span', { class: 'big' }, w.en), h('span', { class: 'meta' }, w.pos)];
    const [front, back] = direction === 'canto-en' ? [canto, en] : [en, canto];
    show(
      ...head,
      h('div', { class: 'progress' }, h('span', {}, `${total - queue.length} of ${total} learnt · ${queue.length} to go`)),
      h('button', { class: 'card', type: 'button', 'aria-label': flipped ? 'Card, turned over' : 'Card. Select to turn over.', onclick: () => { flipped = !flipped; render(); } },
        ...front,
        ...(flipped ? [h('hr', { class: 'divider', 'aria-hidden': 'true' }), ...back,
          w.classifier ? h('span', { class: 'meta' }, 'Classifier: ', h('span', { lang: 'yue-Hant-HK' }, w.classifier.cjk), ` ${w.classifier[settings.system]}`) : null,
          w.note ? h('span', { class: 'meta' }, w.note) : null] : [h('span', { class: 'hint' }, 'Select or press Space to turn over')])),
      flipped ? h('div', { class: 'actions' },
        h('button', { class: 'btn', type: 'button', onclick: () => rate(false) }, 'Again'),
        h('button', { class: 'btn btn-primary', type: 'button', onclick: () => rate(true) }, 'Got it')) : null,
      reportLine(`vocabulary/${topicId}: ${w.cjk}`),
    );
    app.querySelector(flipped ? '.actions .btn-primary' : '.card')?.focus();
  };

  start();
  return render;
}

