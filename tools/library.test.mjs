import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { searchVocabulary, searchWords, suggestPatterns, formatWord, formatPattern, formatTopic, practiceQuestions } from './library.mjs';

const data = JSON.parse(readFileSync(new URL('../dist/cantonlink-community.json', import.meta.url), 'utf8'));
const first = (query) => searchVocabulary(data, query, 5)[0]?.cjk;
const HAN = /\p{Script=Han}/u;

test('finds words the way learners without characters type them', () => {
  const cases = {
    你好: ['nei5 hou2', 'nei hou', 'lei hou', 'neihou', 'leihou', 'néih hóu', 'neih hou'],
    唔該: ['m4 goi1', 'm goi', 'mgoi', 'mh goi', 'm̀h gōi', 'm4goi1', 'thank you for a service'],
    多謝: ['do1 ze6', 'do ze', 'dō jeh', 'do jeh', 'doze'],
    食: ['sik6', 'sik', 'sihk', 'eat', 'eating'],
  };
  for (const [cjk, queries] of Object.entries(cases)) {
    for (const query of queries) assert.equal(first(query), cjk, `"${query}" should find ${cjk}`);
  }
});

test('a tone that is given must match, or the result is only approximate', () => {
  const right = searchWords(data, 'sik6').find((r) => r.word.cjk === '食');
  assert.equal(right.approx, false);
  const wrong = searchWords(data, 'sik1', 50).find((r) => r.word.cjk === '食');
  assert.ok(wrong, 'a wrong tone still finds the word');
  assert.equal(wrong.approx, true);
  assert.ok(searchWords(data, 'sik1').every((r, i, all) => i === 0 || all[i - 1].score >= r.score));
});

test('one-letter slips are approximate matches; nonsense finds nothing', () => {
  const slip = searchWords(data, 'nei hoe');
  assert.equal(slip[0]?.word.cjk, '你好');
  assert.equal(slip[0].approx, true);
  assert.deepEqual(searchVocabulary(data, 'xyzzy'), []);
  assert.deepEqual(searchVocabulary(data, 'qqqq'), []);
});

test('pattern suggestions match Jyutping and Yale', () => {
  for (const query of ['zo2', 'zo', 'jo', 'jó']) assert.ok(suggestPatterns(data, query).some((p) => p.id === 'zo2-completed'), query);
});

test('romanisation-only display shows no characters anywhere', () => {
  for (const romanisation of ['jyutping', 'yale']) {
    const display = { characters: false, romanisation };
    for (const t of data.vocabulary) {
      assert.doesNotMatch(formatTopic(t, display), HAN, t.id);
      for (const w of t.words) assert.doesNotMatch(formatWord(w, display), HAN, w.jyutping);
    }
    for (const p of data.grammar) assert.doesNotMatch(formatPattern(p, display), HAN, p.id);
    for (const type of ['fill_the_gap', 'build_the_sentence']) {
      for (const q of practiceQuestions(data, type, { count: 1000, display })) assert.doesNotMatch(`${q.question}\n${q.answer}`, HAN, type);
    }
  }
});

test('romanisation-only display leads with the chosen system', () => {
  const word = data.vocabulary.flatMap((t) => t.words).find((w) => w.cjk === '唔該');
  assert.match(formatWord(word, { characters: false, romanisation: 'jyutping' }), /^m4 goi1 \| Yale: m̀h gōi — /);
  assert.match(formatWord(word, { characters: false, romanisation: 'yale' }), /^m̀h gōi \| Jyutping: m4 goi1 — /);
  const pattern = data.grammar.find((p) => p.id === 'hai6-copula');
  assert.match(formatPattern(pattern, { characters: false, romanisation: 'yale' }), /^# Subject \+ haih \+ Noun/);
});

test('romanisation-only prose keeps a space between adjacent words, as the site does', () => {
  const hai6 = formatPattern(data.grammar.find((p) => p.id === 'hai6-copula'), { characters: false });
  assert.match(hai6, /say keoi5 hou2 gou1 \(he is tall\)/);
  assert.doesNotMatch(data.grammar.map((p) => formatPattern(p, { characters: false })).join('\n'), /[1-6][a-z]+[1-6]/, 'no two syllables run together');
});

test('the default display is unchanged, with characters', () => {
  const word = data.vocabulary.flatMap((t) => t.words).find((w) => w.cjk === '唔該');
  assert.match(formatWord(word), /^唔該 — m4 goi1 \| Yale: m̀h gōi \| Bopomofo: /);
  assert.equal([word].map(formatWord)[0], formatWord(word), 'safe to pass to Array.map');
  assert.match(formatPattern(data.grammar.find((p) => p.id === 'hai6-copula')), /^# Subject \+ 係 \+ Noun \(Subject \+ hai6 \+ Noun\)/);
});
