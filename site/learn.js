import { parseSyllable, romanise } from './romanise.js';
import {
  REPO, LEVELS, SYSTEM_NAME, settings, h, show, rom, han, sentenceEl, sentenceText, pageHead, chips, tag, draftTag, reportLine,
  fold, stats, whenDue, exportProgress, importProgress, resetProgress,
} from './lib.js';
import { aiTaskSection, translateTask, explainTask } from './tutor.js';
import { continueCard } from './path.js';

export function home(data, rerender) {
  const { toReview, answered, correct, dueToday, scheduled, nextDue } = stats();
  const drafts = [...data.grammar, ...data.vocabulary].filter((x) => x.review.status !== 'reviewed').length;
  const wordCount = data.vocabulary.reduce((n, t) => n + t.words.length, 0);
  const card = (href, cjk, title, text) => h('a', { class: 'mode-card', href }, h('span', { class: 'mode-cjk', lang: 'yue-Hant-HK' }, cjk), h('h3', {}, title), h('p', {}, text));

  const fileInput = h('input', {
    type: 'file', accept: 'application/json', class: 'visually-hidden', id: 'import-file',
    onchange: async (e) => {
      const [file] = e.target.files;
      if (!file) return;
      try {
        importProgress(await file.text());
        rerender();
      } catch (error) {
        alert(error.message);
      }
    },
  });
  const download = () => {
    const url = URL.createObjectURL(new Blob([exportProgress()], { type: 'application/json' }));
    h('a', { href: url, download: 'cantonlink-progress.json' }).click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  show(
    h('h1', {}, '學廣東話 · Learn Cantonese'),
    h('p', { class: 'lede' }, `Grammar, vocabulary and practice for spoken Hong Kong Cantonese, shown in ${SYSTEM_NAME[settings.system]}. Change to Jyutping, Yale or Bopomofo under Display. Free, with no account.`),
    drafts ? h('p', { class: 'notice' },
      h('strong', {}, 'First draft. '),
      `${drafts} of ${data.grammar.length + data.vocabulary.length} grammar patterns and word lists are awaiting review by native speakers. `,
      h('a', { href: `${REPO}/blob/main/library/review-status.md` }, 'Review status'), ' · ',
      h('a', { href: `${REPO}/issues/new?template=reviewer.yml` }, 'Help review')) : null,

    continueCard(data),

    h('section', { 'aria-labelledby': 'learn-heading' },
      h('h2', { id: 'learn-heading' }, 'Learn'),
      h('div', { class: 'modes' },
        card('#/grammar', '文法', 'Grammar', `${data.grammar.length} patterns from A1 to B1, each with examples and common mistakes.`),
        card('#/vocabulary', '詞彙', 'Vocabulary', `${wordCount} everyday words in ${data.vocabulary.length} topics, with classifiers.`),
        card('#/lookup', '查字', 'Look up', 'Find a word from English, Jyutping or characters, or convert Jyutping to Yale and Bopomofo.'))),

    h('section', { 'aria-labelledby': 'practise-heading' },
      h('h2', { id: 'practise-heading' }, 'Practise'),
      h('div', { class: 'modes' },
        card('#/flashcards', '溫習', 'Flashcards', 'Learn the words in each topic, in either direction.'),
        card('#/fill-the-gap', '填充', 'Fill the gap', 'Pick the grammar word that matches the meaning.'),
        card('#/build', '砌句', 'Build the sentence', 'Put the words in natural Cantonese order.'),
        card('#/tones', '聲調', 'Tones', 'Choose the right tone for words you know.'),
        card('#/tutor', '對話', 'AI tutor', 'Chat in Cantonese with an AI model of your choice; every reply is checked.'),
        card('#/spoken-or-written', '口語', 'Spoken or written?', 'Tell real spoken Cantonese from written Chinese.'))),

    h('section', { class: 'panel progress-panel', 'aria-labelledby': 'progress-heading' },
      h('h2', { id: 'progress-heading' }, 'Your progress'),
      h('p', {}, answered
        ? `You have answered ${answered} questions, ${Math.round((correct / answered) * 100)}% correctly.`
        : 'Your answers are saved in this browser only. Questions you miss are kept here for review.'),
      scheduled ? h('p', { class: 'due-line' }, toReview
        ? `${toReview} item${toReview === 1 ? '' : 's'} due now${dueToday > toReview ? `, ${dueToday - toReview} more later today` : ''}. ${scheduled} in your review schedule.`
        : `Nothing due now. Next review ${whenDue(nextDue)}; ${scheduled} item${scheduled === 1 ? '' : 's'} in your review schedule.`) : null,
      h('div', { class: 'actions' },
        toReview ? h('a', { class: 'btn btn-primary', href: '#/review' }, `Review ${toReview} item${toReview === 1 ? '' : 's'}`) : null,
        h('button', { class: 'btn', type: 'button', onclick: download }, 'Export progress'),
        h('label', { class: 'btn', for: 'import-file' }, 'Import progress'), fileInput,
        answered ? h('button', { class: 'btn btn-quiet', type: 'button', onclick: () => { if (confirm('Clear your saved progress in this browser?')) { resetProgress(); rerender(); } } }, 'Reset') : null)),

    h('section', { class: 'more' },
      h('h2', {}, 'More'),
      h('ul', {},
        h('li', {}, h('a', { href: `${REPO}/tree/main/library` }, 'The library on GitHub'), ': every page as readable text, with printable worksheets'),
        h('li', {}, h('a', { href: `${REPO}/blob/main/library/romanisation.md` }, 'Romanisation guide'), ': how Jyutping, Yale and Bopomofo compare'),
        h('li', {}, h('a', { href: `${REPO}/blob/main/dist/cantonlink-community.json` }, 'Download the data'), ' (CC BY-SA 4.0) for your own app or class'))),
  );
}

// --- Grammar --------------------------------------------------------------

export function grammarList(data, level, setLevel) {
  const patterns = data.grammar.filter((p) => level === 'all' || p.level === level);
  const groups = Map.groupBy(patterns, (p) => p.functionName);
  show(
    ...pageHead('Grammar', { lede: 'Everyday patterns of spoken Cantonese. Choose one to see examples and common mistakes.' }),
    chips([['all', 'All levels'], ...LEVELS.map((l) => [l, l])], level, setLevel, 'Level'),
    ...[...groups].map(([name, items]) => h('section', { class: 'group' },
      h('h2', {}, name),
      h('ul', { class: 'list' }, items.map((p) => h('li', {},
        h('a', { class: 'list-item', href: `#/grammar/${p.id}` },
          h('span', { class: 'list-main' }, h('span', { class: 'cjk', lang: 'yue-Hant-HK' }, p.pattern), h('span', { class: 'list-sub' }, p.meaning)),
          h('span', { class: 'list-tags' }, tag(p.level), p.review.status === 'reviewed' ? null : tag('Draft', 'tag-draft')))))))),
  );
}

export function grammarDetail(data, id) {
  const p = data.grammar.find((x) => x.id === id);
  if (!p) return notFound();
  const byId = new Map(data.grammar.map((x) => [x.id, x]));
  show(
    ...pageHead(p.pattern, { back: ['#/grammar', 'Grammar'] }),
    h('p', { class: 'meta-line' }, tag(p.level), ' ', p.functionName, ' · ', draftTag(p.review)),
    h('p', { class: 'meaning' }, p.meaning),
    h('p', {}, p.explanation),
    p.writtenEquivalent ? h('p', { class: 'aside' }, h('strong', {}, 'Written Chinese: '), h('span', { lang: 'yue-Hant-HK' }, p.writtenEquivalent.cjk), ` — ${p.writtenEquivalent.note}`) : null,
    h('h2', {}, 'Examples'),
    ...p.examples.map((ex) => h('div', { class: 'example' }, sentenceEl(ex.tokens), h('p', { class: 'en' }, ex.en))),
    p.mistakes.length ? h('h2', {}, 'Common mistakes') : null,
    ...p.mistakes.map((m) => h('div', { class: 'mistake' },
      h('p', {}, h('span', { class: 'label' }, 'Avoid'), h('s', { lang: 'yue-Hant-HK' }, m.incorrect)),
      h('p', {}, h('span', { class: 'label' }, 'Say'), sentenceText(m.correct)),
      h('p', { class: 'small' }, m.note))),
    p.related.length ? h('h2', {}, 'Related') : null,
    p.related.length ? h('ul', { class: 'related' }, p.related.map((r) => h('li', {}, h('a', { href: `#/grammar/${r}`, lang: 'yue-Hant-HK' }, byId.get(r).pattern), ` — ${byId.get(r).meaning}`))) : null,
    h('h2', {}, 'Explain with AI'),
    aiTaskSection(data, { task: explainTask(p), label: 'Explain with more examples', intro: 'Get a fresh explanation and new examples from an AI model, checked against this library.' }),
    h('div', { class: 'actions' },
      data.practice.fillGap.some((q) => q.patternId === p.id) ? h('a', { class: 'btn btn-primary', href: `#/fill-the-gap?pattern=${p.id}` }, 'Practise this pattern') : null,
      h('a', { class: 'btn', href: '#/grammar' }, 'All patterns')),
    reportLine(`grammar/${p.id}`),
  );
}

// --- Vocabulary -----------------------------------------------------------

export function vocabularyList(data) {
  show(
    ...pageHead('Vocabulary', { lede: 'Everyday words by topic. Each list can be practised as flashcards.' }),
    h('div', { class: 'modes' }, data.vocabulary.map((t) => h('a', { class: 'mode-card', href: `#/vocabulary/${t.id}` },
      h('span', { class: 'mode-cjk', lang: 'yue-Hant-HK' }, t.titleCjk), h('h3', {}, t.title), h('p', {}, `${t.words.length} words`, t.review.status === 'reviewed' ? '' : ' · draft')))),
  );
}

export function vocabularyTopic(data, id) {
  const t = data.vocabulary.find((x) => x.id === id);
  if (!t) return notFound();
  show(
    ...pageHead(t.title, { back: ['#/vocabulary', 'Vocabulary'] }),
    h('p', { class: 'meta-line' }, h('span', { lang: 'yue-Hant-HK' }, t.titleCjk), ' · ', `${t.words.length} words`, ' · ', draftTag(t.review)),
    h('div', { class: 'actions' }, h('a', { class: 'btn btn-primary', href: `#/flashcards?topic=${t.id}` }, 'Practise as flashcards')),
    wordList(t.words),
    reportLine(`vocabulary/${t.id}`),
  );
}

function wordList(words, topicOf) {
  return h('ul', { class: 'words' }, words.map((w) => h('li', { class: 'word-row' },
    h('span', { class: 'word-canto' }, rom(w, 'rom word-rom'), han(w, 'han word-han')),
    h('span', { class: 'word-en' }, w.en,
      w.classifier ? h('span', { class: 'small' }, ' Classifier: ', h('span', { lang: 'yue-Hant-HK' }, w.classifier.cjk), ` ${w.classifier[settings.system]}`) : null,
      w.note ? h('span', { class: 'small note' }, w.note) : null,
      topicOf ? h('span', { class: 'small' }, ' ', h('a', { href: `#/vocabulary/${topicOf(w).id}` }, topicOf(w).title)) : null))));
}

// --- Look up --------------------------------------------------------------

export function lookup(data, initialQuery) {
  const words = data.vocabulary.flatMap((t) => t.words.map((w) => ({ ...w, topic: t })));
  const results = h('div', { id: 'lookup-results', 'aria-live': 'polite' });

  const update = (query) => {
    const q = query.trim();
    const fq = fold(q);
    const syllables = q.toLowerCase().split(/\s+/).filter(Boolean);
    const isJyutping = syllables.length > 0 && syllables.every((s) => parseSyllable(s));
    const matches = fq ? words.filter((w) => fold(w.en).includes(fq) || fold(w.jyutping).startsWith(fq) || fold(w.yale).startsWith(fq) || w.cjk.includes(q)) : [];
    const patterns = fq ? data.grammar.filter((p) => fold(p.meaning).includes(fq) || p.pattern.includes(q)) : [];
    const converted = isJyutping ? romanise(syllables.join(' ')) : null;
    results.replaceChildren(
      converted ? h('div', { class: 'panel convert' },
        h('h2', {}, 'Conversion'),
        h('dl', {}, ...['jyutping', 'yale', 'bopomofo'].flatMap((sys) => [h('dt', {}, SYSTEM_NAME[sys]), h('dd', { lang: sys === 'bopomofo' ? 'yue-Bopo' : 'yue-Latn' }, converted[sys])]))) : '',
      fq ? h('h2', {}, matches.length ? `${matches.length} word${matches.length === 1 ? '' : 's'}` : 'No words found') : '',
      matches.length ? wordList(matches.slice(0, 60), (w) => w.topic) : '',
      patterns.length ? h('h2', {}, 'Grammar') : '',
      patterns.length ? h('ul', { class: 'related' }, patterns.map((p) => h('li', {}, h('a', { href: `#/grammar/${p.id}`, lang: 'yue-Hant-HK' }, p.pattern), ` — ${p.meaning}`))) : '',
      fq && !converted && /[a-z]/i.test(q) && !/\p{Script=Han}/u.test(q)
        ? h('section', { class: 'ai-translate' }, h('h2', {}, matches.length ? 'Translate the whole phrase' : 'Not in the library'),
          aiTaskSection(data, { task: translateTask(q), label: `Translate "${q.length > 40 ? `${q.slice(0, 40)}…` : q}" with AI`, intro: 'An AI model can translate any English phrase, checked against this library.' }))
        : '',
    );
    history.replaceState(null, '', q ? `#/lookup?q=${encodeURIComponent(q)}` : '#/lookup');
  };

  const input = h('input', {
    type: 'search', id: 'lookup-input', class: 'search', value: initialQuery, autocomplete: 'off', spellcheck: 'false',
    placeholder: 'e.g. thank you, m4 goi1, 唔該', 'aria-describedby': 'lookup-help',
    oninput: (e) => { if (!e.isComposing) update(e.target.value); },
    oncompositionend: (e) => update(e.target.value),
  });
  show(
    ...pageHead('Look up', { lede: 'Search the vocabulary in English, Jyutping (tone numbers optional), Yale or characters. Type Jyutping with tone numbers to convert it to Yale and Bopomofo.' }),
    h('label', { for: 'lookup-input', class: 'visually-hidden' }, 'Search'),
    input,
    h('p', { id: 'lookup-help', class: 'small' }, `Covers the ${words.length} words and ${data.grammar.length} grammar patterns in this library. It is not a full dictionary.`),
    results,
  );
  update(initialQuery);
  input.focus();
}

export function notFound() {
  show(...pageHead('Page not found'), h('p', {}, 'That page does not exist. ', h('a', { href: '#/' }, 'Go to the home page'), '.'));
}
