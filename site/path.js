import { LEVELS, h, show, rom, han, pageHead, tag, chips, isDone, markDone, shuffle, sentenceEl, patternName } from './lib.js';
import { runSession, itemKey, dialogueBuildItems } from './practice.js';
import { aiReady } from './ai-settings.js';

// A unit counts as complete once most of its practice has been answered
// correctly at least once; nobody needs every flashcard to move on.
const COMPLETE = 0.8;

function unitItems(data, unit) {
  const patterns = new Set(unit.patterns);
  return [
    ...data.practice.fillGap.filter((q) => patterns.has(q.patternId)).map((q) => ({ kind: 'fill', q })),
    ...data.practice.buildSentence.filter((q) => patterns.has(q.patternId)).map((q) => ({ kind: 'build', q })),
    ...data.vocabulary.filter((t) => unit.topics.includes(t.id)).flatMap((t) => t.words.map((word) => ({ kind: 'card', q: { word, topic: t.id } }))),
    ...dialogueBuildItems(data, unit),
  ];
}

// Each of the learner's lines in Try first counts once it has been revealed.
const sayKeys = (unit) => (unit.dialogue?.lines ?? []).flatMap((line, i) => (line.speaker === 'B' ? [`say:${unit.id}:${i}`] : []));

export function unitProgress(data, unit) {
  const items = [...unitItems(data, unit).map(itemKey), ...sayKeys(unit)];
  const done = items.filter(isDone).length;
  return { done, total: items.length, share: items.length ? done / items.length : 0, complete: done >= items.length * COMPLETE };
}

export const currentUnit = (data) => data.path.find((u) => !unitProgress(data, u).complete) ?? null;

const unitNumber = (data, unit) => data.path.indexOf(unit) + 1;
const unitTitle = (unit) => [unit.title, ' · ', rom(unit.titleWord), ' ', han(unit.titleWord)];

function progressBar(progress, label) {
  const percent = Math.round(progress.share * 100);
  return h('div', { class: 'progress' },
    h('div', { class: 'progress-bar', role: 'progressbar', 'aria-label': label, 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': percent },
      h('span', { style: `width: ${percent}%` })),
    h('span', {}, `${percent}%`));
}

const tutorLink = (unit) => `#/tutor?level=${unit.level}&scenario=${unit.scenario}&unit=${unit.id}`;

export function continueCard(data) {
  const unit = currentUnit(data);
  if (!unit) {
    return h('section', { class: 'panel continue' },
      h('h2', {}, 'Learning path complete'),
      h('p', {}, `You have worked through all ${data.path.length} units. Keep your review up to date, or chat with the AI tutor at B1.`),
      h('a', { class: 'btn', href: '#/path' }, 'See the path'));
  }
  const progress = unitProgress(data, unit);
  return h('section', { class: 'panel continue', 'aria-labelledby': 'continue-heading' },
    h('p', { class: 'eyebrow' }, `${progress.done ? 'Continue' : 'Start'} · Unit ${unitNumber(data, unit)} of ${data.path.length} · ${unit.level}`),
    h('h2', { id: 'continue-heading' }, ...unitTitle(unit)),
    h('p', {}, unit.goal),
    progressBar(progress, `Progress in ${unit.title}`),
    h('div', { class: 'actions' },
      h('a', { class: 'btn btn-primary', href: `#/path/${unit.id}` }, progress.done ? 'Continue' : 'Start the unit'),
      h('a', { class: 'btn', href: '#/path' }, 'All units')));
}

export function pathView(data) {
  const current = currentUnit(data);
  show(
    ...pageHead('Learning path', { lede: `${data.path.length} units from A1 to B1. Each unit teaches a few grammar patterns with vocabulary, around an everyday situation. A unit is complete once you have practised ${Math.round(COMPLETE * 100)}% of it.` }),
    ...LEVELS.map((level) => h('section', { 'aria-labelledby': `path-${level}` },
      h('h2', { id: `path-${level}` }, `Level ${level}`),
      h('ol', { class: 'path', start: data.path.findIndex((u) => u.level === level) + 1 },
        data.path.filter((u) => u.level === level).map((unit) => {
          const progress = unitProgress(data, unit);
          return h('li', { class: `path-unit${unit === current ? ' current' : ''}${progress.complete ? ' complete' : ''}` },
            h('a', { href: `#/path/${unit.id}` }, h('h3', {}, ...unitTitle(unit))),
            h('p', {}, unit.goal),
            progressBar(progress, `Progress in ${unit.title}`),
            progress.complete ? tag('Complete', 'tag-good') : unit === current ? tag('Up next') : null);
        })))),
  );
}

// The unit's model dialogue. "Try first" is the output-first pattern: the
// learner plays B, sees what to say in English, tries it aloud, then reveals
// it. "Read" shows the whole dialogue. Reveals last for this visit; that a
// line was practised is kept in progress.
let dialogueMode = 'try';
const revealed = new Map();

function askCard(line, i, onReveal) {
  return h('li', { class: 'dialogue-line speaker-B step-ask', 'data-line': i },
    h('p', { class: 'step-label' }, 'Step 1 · ask'),
    h('p', { class: 'step-question' }, `How would you say “${line.en}”?`),
    h('p', { class: 'try-box' }, 'Try first · we’ll show after. Say it out loud, or write it down.'),
    h('button', { class: 'btn btn-primary btn-small', type: 'button', onclick: onReveal }, 'Reveal'));
}

function revealCard(line, speaker) {
  return h('li', { class: 'dialogue-line speaker-B step-reveal', tabindex: '-1' },
    h('p', { class: 'step-label' }, `Step 2 · reveal · ${speaker}`),
    sentenceEl(line.tokens),
    h('p', { class: 'step-en' }, line.en));
}

function dialogueSection(unit) {
  const d = unit.dialogue;
  const shown = revealed.get(unit.id) ?? new Set();
  revealed.set(unit.id, shown);
  const lines = h('ol', { class: 'dialogue' });
  const status = h('p', { class: 'visually-hidden', role: 'status' });
  const plainLine = (line) => h('li', { class: `dialogue-line speaker-${line.speaker}` },
    h('p', { class: 'speaker' }, d.speakers[line.speaker]),
    sentenceEl(line.tokens),
    h('p', { class: 'en' }, line.en));

  const reveal = (indexes) => {
    for (const i of indexes) {
      shown.add(i);
      markDone(`say:${unit.id}:${i}`);
    }
    render();
    status.textContent = indexes.length > 1 ? 'All lines revealed.' : 'Line revealed.';
    const next = lines.querySelector('.step-ask button');
    (next ?? lines.lastElementChild)?.focus?.({ preventScroll: false });
  };

  const actions = h('div', { class: 'actions' });
  function render() {
    lines.classList.toggle('try-first', dialogueMode === 'try');
    if (dialogueMode === 'read') {
      lines.replaceChildren(...d.lines.map(plainLine));
      actions.replaceChildren();
      return;
    }
    const items = [];
    for (const [i, line] of d.lines.entries()) {
      if (line.speaker !== 'B') items.push(plainLine(line));
      else if (shown.has(i)) items.push(revealCard(line, d.speakers.B));
      else {
        items.push(askCard(line, i, () => reveal([i])));
        break;
      }
    }
    lines.replaceChildren(...items);
    const hidden = d.lines.flatMap((line, i) => (line.speaker === 'B' && !shown.has(i) ? [i] : []));
    actions.replaceChildren(...[
      hidden.length ? h('button', { class: 'btn btn-small', type: 'button', onclick: () => reveal(hidden) }, 'Reveal all') : null,
      shown.size ? h('button', { class: 'btn btn-small btn-quiet', type: 'button', onclick: () => { shown.clear(); render(); lines.querySelector('.step-ask button')?.focus(); } }, 'Start again') : null,
    ].filter(Boolean));
  }

  const toggle = h('button', {
    class: 'btn btn-small', type: 'button', 'aria-pressed': 'false',
    onclick: () => {
      const showing = lines.classList.toggle('show-en');
      toggle.setAttribute('aria-pressed', String(showing));
      toggle.textContent = showing ? 'Hide English' : 'Show English';
    },
  }, 'Show English');
  const intro = h('p', { class: 'small' });
  const modes = h('div');
  const setMode = (mode) => {
    dialogueMode = mode;
    modes.replaceChildren(chips([['try', 'Try first'], ['read', 'Read']], mode, setMode, 'Dialogue mode'));
    intro.textContent = mode === 'try'
      ? `You are ${d.speakers.B}. For each of your lines, try saying it before you reveal it.`
      : 'Read it aloud, taking each part in turn. Try to understand it before you show the English.';
    render();
  };
  setMode(dialogueMode);
  return h('section', { class: 'panel', 'aria-labelledby': 'dialogue-heading' },
    h('h2', { id: 'dialogue-heading' }, `3. Model dialogue: ${d.title}`),
    modes, intro, toggle, lines, actions, status);
}

export function unitView(data, id) {
  const unit = data.path.find((u) => u.id === id);
  if (!unit) return false;
  const progress = unitProgress(data, unit);
  const n = unitNumber(data, unit);
  const next = data.path[n];
  const patterns = unit.patterns.map((pid) => data.grammar.find((p) => p.id === pid));
  const topics = unit.topics.map((tid) => data.vocabulary.find((t) => t.id === tid));
  show(
    ...pageHead(`Unit ${n}: ${unit.title}`, { back: ['#/path', 'Learning path'], lede: unit.goal }),
    h('p', { class: 'unit-title' }, rom(unit.titleWord, 'rom big-rom'), ' ', han(unit.titleWord), ' ', tag(unit.level)),
    progressBar(progress, `Progress in ${unit.title}`),
    h('p', { class: 'small' }, `${progress.done} of ${progress.total} exercises practised.`),
    h('section', { class: 'panel' },
      h('h2', {}, '1. Learn the grammar'),
      h('ul', { class: 'link-list' }, patterns.map((p) => h('li', {}, h('a', { href: `#/grammar/${p.id}` }, patternName(p)), ` — ${p.meaning}`)))),
    h('section', { class: 'panel' },
      h('h2', {}, '2. Learn the words'),
      h('ul', { class: 'link-list' }, topics.map((t) => h('li', {},
        h('a', { href: `#/vocabulary/${t.id}` }, t.title), ` — ${t.words.length} words · `,
        h('a', { href: `#/flashcards?topic=${t.id}` }, 'Flashcards'))))),
    dialogueSection(unit),
    h('section', { class: 'panel' },
      h('h2', {}, '4. Practise'),
      h('p', {}, 'A mixed session of fill-the-gap, sentence-building (including lines from the dialogue) and flashcards from this unit, starting with what you have not practised yet. With an AI key, you can also act out the dialogue\'s situation with the tutor.'),
      h('div', { class: 'actions' },
        h('a', { class: 'btn btn-primary', href: `#/path/${unit.id}/practise` }, 'Practise this unit'),
        h('a', { class: 'btn', href: tutorLink(unit) }, aiReady() ? 'Role-play with the AI tutor' : 'AI tutor (needs a key)'))),
    next ? h('p', {}, progress.complete ? 'Unit complete. ' : '', 'Next: ', h('a', { href: `#/path/${next.id}` }, `Unit ${n + 1}: ${next.title}`)) : null,
  );
  return true;
}

export function unitPractice(data, id) {
  const unit = data.path.find((u) => u.id === id);
  if (!unit) return null;
  const pick = (kind, count) => {
    const items = shuffle(unitItems(data, unit).filter((item) => item.kind === kind));
    return [...items.filter((item) => !isDone(itemKey(item))), ...items.filter((item) => isDone(itemKey(item)))].slice(0, count);
  };
  return runSession(data, {
    title: `Practise: ${unit.title}`,
    lede: unit.goal,
    back: [`#/path/${unit.id}`, `Unit ${unitNumber(data, unit)}`],
    exit: [`#/path/${unit.id}`, 'Back to the unit'],
    makeItems: () => shuffle([...pick('fill', 5), ...pick('build', 3), ...pick('card', 4)]),
  });
}
