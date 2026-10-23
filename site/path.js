import { LEVELS, h, show, rom, han, pageHead, tag, isDone, shuffle } from './lib.js';
import { runSession, itemKey } from './practice.js';
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
  ];
}

export function unitProgress(data, unit) {
  const items = unitItems(data, unit);
  const done = items.filter((item) => isDone(itemKey(item))).length;
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
      h('ul', { class: 'link-list' }, patterns.map((p) => h('li', {}, h('a', { href: `#/grammar/${p.id}` }, p.pattern), ` — ${p.meaning}`)))),
    h('section', { class: 'panel' },
      h('h2', {}, '2. Learn the words'),
      h('ul', { class: 'link-list' }, topics.map((t) => h('li', {},
        h('a', { href: `#/vocabulary/${t.id}` }, t.title), ` — ${t.words.length} words · `,
        h('a', { href: `#/flashcards?topic=${t.id}` }, 'Flashcards'))))),
    h('section', { class: 'panel' },
      h('h2', {}, '3. Practise'),
      h('p', {}, 'A mixed session of fill-the-gap, sentence-building and flashcards from this unit, starting with what you have not practised yet.'),
      h('div', { class: 'actions' },
        h('a', { class: 'btn btn-primary', href: `#/path/${unit.id}/practise` }, 'Practise this unit'),
        h('a', { class: 'btn', href: tutorLink(unit) }, aiReady() ? 'Practise with the AI tutor' : 'AI tutor (needs a key)'))),
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
    makeItems: () => shuffle([...pick('fill', 5), ...pick('build', 2), ...pick('card', 5)]),
  });
}
