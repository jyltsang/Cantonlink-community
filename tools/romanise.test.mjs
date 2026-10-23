import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isValidSyllable, toYale, toBopomofo, romanise, phraseToYale, phraseToBopomofo } from './romanise.mjs';

const table = readFileSync(new URL('../data/third-party/pingyambiu.tsv', import.meta.url), 'utf8')
  .split('\n')
  .filter((line) => line && !line.startsWith('#'))
  .map((line) => line.split('\t'))
  .map((cols) => ({ yale: cols[1].normalize('NFC'), jyutping: cols[6] }))
  .filter(({ jyutping }) => /^[a-z]+[1-6]$/.test(jyutping) && !/^h(m|ng)\d/.test(jyutping));

// pingyambiu often puts the tone mark on a later vowel (biū, seúhng);
// textbook Yale marks the first vowel of the final (bīu, séuhng), which is
// what we follow. So compare the letters and the tone mark, not its position.
const skeleton = (yale) => {
  const decomposed = yale.normalize('NFD');
  return { letters: decomposed.replace(/\p{M}/gu, ''), marks: decomposed.replace(/\P{M}/gu, '') };
};

// Typographic slips in pingyambiu itself (e.g. "gagk" for gahk, "m¯" for m̄).
const PINGYAMBIU_ERRATA = new Set(['gak6', 'kak6', 'pot6', 'm1', 'ng1']);

test('every pingyambiu Jyutping syllable is accepted', () => {
  const rejected = table.filter(({ jyutping }) => !isValidSyllable(jyutping)).map((r) => r.jyutping);
  assert.deepEqual(rejected, []);
});

test('Yale matches pingyambiu for every syllable', () => {
  const mismatches = table
    .filter(({ jyutping }) => !PINGYAMBIU_ERRATA.has(jyutping))
    .filter(({ jyutping, yale }) => JSON.stringify(skeleton(toYale(jyutping))) !== JSON.stringify(skeleton(yale)))
    .map(({ jyutping, yale }) => `${jyutping}: got ${toYale(jyutping)}, expected ${yale}`);
  assert.deepEqual(mismatches, []);
});

test('Yale follows textbook conventions', () => {
  const cases = {
    nei5: 'néih', hou2: 'hóu', keoi5: 'kéuih', soeng2: 'séung', soeng5: 'séuhng',
    sik6: 'sihk', naam4: 'nàahm', jyu4: 'yùh', zyu1: 'jyū', gaa1: 'gā', m4: 'm̀h', ng5: 'ńgh',
    hoeng1: 'hēung', coek3: 'cheuk', ceot1: 'chēut', jat1: 'yāt',
  };
  for (const [jp, yale] of Object.entries(cases)) assert.equal(toYale(jp), yale.normalize('NFC'), jp);
});

test('Bopomofo distinguishes long and short a and all six tones', () => {
  assert.equal(toBopomofo('gaai1'), 'ㄍㄚㄧ¹');
  assert.equal(toBopomofo('gai1'), 'ㄍㄜㄧ¹');
  assert.equal(toBopomofo('jyu4'), 'ㄩ⁴');
  assert.equal(toBopomofo('jau5'), 'ㄧㄜㄨ⁵');
  assert.equal(toBopomofo('m4'), 'ㆬ⁴');
  const tones = [1, 2, 3, 4, 5, 6].map((t) => toBopomofo(`si${t}`));
  assert.equal(new Set(tones).size, 6);
});

// The marginal interjection syllables ik/it share a spelling with jik/jit,
// because j before i is written by the vowel alone. Neither appears in content.
const BOPOMOFO_HOMOGRAPHS = /^i[kt]\d$/;

test('Bopomofo is unambiguous across all valid syllables', () => {
  const seen = new Map();
  for (const { jyutping } of table.filter(({ jyutping }) => !BOPOMOFO_HOMOGRAPHS.test(jyutping))) {
    const bpmf = toBopomofo(jyutping);
    if (seen.has(bpmf) && seen.get(bpmf) !== jyutping) assert.fail(`${jyutping} and ${seen.get(bpmf)} both give ${bpmf}`);
    seen.set(bpmf, jyutping);
  }
});

test('invalid syllables are rejected', () => {
  for (const bad of ['nei', 'hou7', 'xin1', 'ngo', 'zhong1', 'Nei5']) assert.equal(isValidSyllable(bad), false, bad);
});

test('romanise converts whole phrases', () => {
  assert.deepEqual(romanise('nei5 hou2'), { jyutping: 'nei5 hou2', yale: 'néih hóu', bopomofo: 'ㄋㄝㄧ⁵ ㄏㄛㄨ²' });
});

test('English words in code-mixed phrases are kept as they are', () => {
  assert.equal(phraseToYale('se2 code'), 'sé code');
  assert.equal(phraseToBopomofo('gon2 deadline'), `${toBopomofo('gon2')} deadline`);
  assert.throws(() => phraseToYale('se7 code'));
});
