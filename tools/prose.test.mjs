import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { proseParts, joinParts, mixedRomanised, patternMismatch } from './prose.mjs';

const lexicon = new Map([['唔該', 'm4 goi1'], ['呢個', 'ni1 go3'], ['咗', 'zo2'], ['呢', 'ni1']]);
const readings = new Map([['咗', new Set(['zo2'])], ['呢', new Set(['ni1', 'ne1'])], ['會', new Set(['wui5', 'wui2'])]]);
const fallback = (cjk) => ({ 他: 'taa1' })[cjk];

test('splits text into plain strings and words, longest library word first', () => {
  const parts = proseParts('Add 咗 after a verb; 唔該 and 呢個.', { lexicon, readings, fallback });
  assert.deepEqual(parts, ['Add ', ['咗', 'zo2'], ' after a verb; ', ['唔該', 'm4 goi1'], ' and ', ['呢個', 'ni1 go3'], '.']);
  assert.equal(joinParts(parts), 'Add 咗 after a verb; 唔該 and 呢個.');
});

test('characters the library lacks use the fallback dictionary', () => {
  assert.deepEqual(proseParts('他 is written', { lexicon, readings, fallback }), [['他', 'taa1'], ' is written']);
});

test('a character with several readings in the library is reported unless an override decides', () => {
  const problems = [];
  proseParts('呢 means this', { lexicon: new Map(), readings, fallback, where: 'p1', problems });
  assert.equal(problems.length, 1);
  assert.match(problems[0], /p1: "呢" .* \(ni1, ne1\)/);

  const used = new Set();
  const overrides = [{ cjk: '會', jyutping: 'wui5' }, { cjk: '呢', jyutping: 'ne1', in: 'p2' }, { cjk: '呢', jyutping: 'ni1' }];
  const none = [];
  assert.deepEqual(proseParts('會 and 呢', { lexicon: new Map(), readings, fallback, where: 'p2', overrides, used, problems: none }), [['會', 'wui5'], ' and ', ['呢', 'ne1']]);
  assert.deepEqual(none, []);
  assert.equal(used.size, 2, 'the entry-specific override wins over the general one');
});

test('pattern Jyutping must line up with the characters', () => {
  assert.equal(patternMismatch('Verb + 咗 + … 未？', 'Verb + zo2 + … mei6?'), null);
  assert.match(patternMismatch('Verb + 咗', 'Verb + zo'), /1 characters but 0/);
  assert.match(patternMismatch('Verb + 咗', 'Verb + zx2'), /invalid Jyutping zx2/);
});

test('mixed text is romanised syllable by syllable, leaving English alone', () => {
  assert.deepEqual(mixedRomanised('Subject + hai6 + Noun'), { jyutping: 'Subject + hai6 + Noun', yale: 'Subject + haih + Noun', bopomofo: 'Subject + ㄏㄜㄧ⁶ + Noun' });
});

test('every prose reading in the published data rebuilds its text and has one syllable per character', () => {
  const data = JSON.parse(readFileSync(new URL('../dist/cantonlink-community.json', import.meta.url), 'utf8'));
  const pairs = [
    ...data.grammar.flatMap((p) => [[p.explanation, p.explanationParts], ...p.mistakes.map((m) => [m.note, m.noteParts])]),
    ...data.vocabulary.flatMap((t) => t.words.filter((w) => w.note).map((w) => [w.note, w.noteParts])),
  ];
  for (const [text, parts] of pairs) {
    assert.equal(parts.map((x) => (typeof x === 'string' ? x : x.cjk)).join(''), text);
    for (const w of parts.filter((x) => typeof x !== 'string')) assert.equal(w.jyutping.split(' ').length, [...w.cjk].length, w.cjk);
  }
  for (const t of data.vocabulary) assert.equal(t.titleWord.cjk, t.titleCjk);
});
