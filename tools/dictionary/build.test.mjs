import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertCleanEnglish, cleanEnglish, assertUniqueIds, parseCedictLine, buildEntries, buildEntriesWithReport } from './build.mjs';
import { phraseToYale, phraseToBopomofo, isValidSyllable } from '../romanise.mjs';

const CANTO = [
  '# a comment',
  '唔該 唔该 [m4 gai1] {m4 goi1} /thank you/excuse me/',
  '食飯 食饭 [shi2 fan4] {sik6 faan6} /to eat a meal/',
  '你好 你好 [ni3 hao3] {nei5 hou2} /hello/',
  '晒 晒 [shai4] {saai3} /to dry/',
  '你 你 [ni3] {nei5} /you/',
];
const READINGS = ['你好 你好 [ni3 hao3] {nei5 hou2}', '之 之 [zhi1] {zi1}', '食飯 食饭 [shi2 fan4] {sik6 faan6}', '無名 无名 [wu2 ming2] {mou4 ming4}'];
const CEDICT = [
  '你好 你好 [ni3 hao3] /hello/hi/',
  '之 之 [zhi1] /him; her; it; (literary) possessive particle/',
  '無名 无名 [wu2 ming2] /nameless/',
  '食飯 食饭 [shi2 fan4] /to have a meal/',
];
const TATOEBA = [
  { id: 11, text: '唔該晒你。', english: 'Thank you very much.' },
  { id: 12, text: '唔該。', english: 'Thanks.' },
  { id: 13, text: '唔該你食飯。', english: 'Please eat.' },
  { id: 14, text: '唔該你同我講。', english: null },
  { id: 15, text: '你好嗎？唔該。', english: 'Hello? Thanks.' },
];
const sources = (over = {}) => ({
  cccanto: CANTO,
  cccedictReadings: READINGS,
  cedict: CEDICT,
  tatoeba: TATOEBA,
  hkcancor: { counts: new Map([['唔該', 5], ['食飯', 10]]), total: 1000 },
  ...over,
});
const find = (entries, characters, jyutping) => entries.find((e) => e.characters === characters && e.jyutping === jyutping);

test('parseCedictLine reads a CC-Canto line', () => {
  assert.deepEqual(parseCedictLine(CANTO[1]), {
    trad: '唔該',
    simp: '唔该',
    jyutping: 'm4 goi1',
    english: ['thank you', 'excuse me'],
  });
});

test('parseCedictLine gives null jyutping for a plain CC-CEDICT line, and null for comments', () => {
  assert.equal(parseCedictLine(CEDICT[0]).jyutping, null);
  assert.deepEqual(parseCedictLine(CEDICT[0]).english, ['hello', 'hi']);
  assert.equal(parseCedictLine('# comment'), null);
  assert.equal(parseCedictLine(''), null);
  assert.equal(parseCedictLine('not a dictionary line'), null);
});

test('parseCedictLine accepts the trailing source comment CC-Canto carries on some lines', () => {
  assert.deepEqual(parseCedictLine('嘅 嘅 [kai3] {ge3} /possessive marker/that/ # adapted from cc-cedict'), {
    trad: '嘅',
    simp: '嘅',
    jyutping: 'ge3',
    english: ['possessive marker', 'that'],
  });
});

test('parseCedictLine normalises jyutping to lower case with single spaces', () => {
  assert.equal(parseCedictLine('A咖 A咖 [A ka1] {A  Gaa3}  /card/').jyutping, 'a gaa3');
  assert.deepEqual(parseCedictLine('一 一 [yi1] {jat1}').english, []);
});

test('entries have exactly the spec keys and the external-unreviewed status', () => {
  const entries = buildEntries(sources(), []);
  const e = find(entries, '唔該', 'm4 goi1');
  assert.deepEqual(
    Object.keys(e).sort(),
    ['bopomofo', 'characters', 'english', 'examples', 'frequency', 'id', 'jyutping', 'register', 'source', 'status', 'syllable_count', 'toneless_key', 'yale'].sort(),
  );
  assert.equal(e.status, 'external-unreviewed');
  assert.equal(e.toneless_key, 'm goi');
  assert.equal(e.syllable_count, 2);
  assert.deepEqual(e.english, ['thank you', 'excuse me']);
  assert.ok(entries.every((x) => x.status === 'external-unreviewed'));
  assert.equal(new Set(entries.map((x) => x.id)).size, entries.length);
});

test('register and source: CC-Canto colloquial, CC-CEDICT readings general, marked written', () => {
  const entries = buildEntries(sources(), []);
  assert.equal(find(entries, '唔該', 'm4 goi1').register, 'colloquial');
  assert.equal(find(entries, '唔該', 'm4 goi1').source, 'cc-canto');
  const general = find(entries, '無名', 'mou4 ming4');
  assert.equal(general.register, 'general');
  assert.equal(general.source, 'cc-cedict');
  assert.deepEqual(general.english, ['nameless']);
  // 之 is in the written-marker list (and its gloss says "(literary)")
  assert.equal(find(entries, '之', 'zi1').register, 'written');
});

test('only a written-style first meaning marks an entry written, not a later sense', () => {
  const two = sources({
    cccanto: [],
    cccedictReadings: ['用 用 [yong4] {jung6}', '其 其 [qi2] {kei4}'],
    cedict: ['用 用 [yong4] /to use/(literary) hence; therefore/', '其 其 [qi2] /(literary) his; her; its/'],
  });
  const entries = buildEntries(two, []);
  assert.equal(find(entries, '用', 'jung6').register, 'general');
  assert.equal(find(entries, '其', 'kei4').register, 'written');
});

test('a word in both CC-Canto and CC-CEDICT readings appears once, as CC-Canto', () => {
  const entries = buildEntries(sources(), []);
  assert.equal(entries.filter((e) => e.characters === '你好').length, 1);
  assert.equal(find(entries, '你好', 'nei5 hou2').source, 'cc-canto');
});

test('yale and bopomofo regenerate identically and every syllable is valid', () => {
  for (const e of buildEntries(sources(), [])) {
    assert.equal(e.yale, phraseToYale(e.jyutping));
    assert.equal(e.bopomofo, phraseToBopomofo(e.jyutping));
    assert.ok(e.jyutping.split(' ').every(isValidSyllable), e.jyutping);
    assert.equal(e.jyutping, e.jyutping.toLowerCase());
    assert.equal(e.toneless_key, e.jyutping.replace(/[1-6]/g, ''));
  }
});

test('an entry with an invalid syllable is dropped and counted in the report', () => {
  const bad = sources({ cccanto: [...CANTO, '壞 坏 [huai4] {gx9} /bad/', '字 字 [zi4] {zi6 檔:dong2} /word/'] });
  const { entries, report } = buildEntriesWithReport(bad, []);
  assert.equal(entries.find((e) => e.characters === '壞'), undefined);
  assert.equal(entries.find((e) => e.characters === '字'), undefined);
  assert.equal(report.droppedInvalid, 2);
});

test('entries with no English or no example are kept', () => {
  const entries = buildEntries(sources({ cccanto: [...CANTO, '稀有 稀有 [xi1 you3] {hei1 jau5}', '食飯 食饭 [shi2 fan4] {sik6 faan6} /to eat a meal/'] }), []);
  const rare = find(entries, '稀有', 'hei1 jau5');
  assert.deepEqual(rare.english, []);
  assert.deepEqual(rare.examples, []);
});

test('examples: Tatoeba id kept, shortest first, at most two, English required', () => {
  const e = find(buildEntries(sources(), []), '唔該', 'm4 goi1');
  assert.equal(e.examples.length, 2);
  assert.deepEqual(e.examples.map((x) => x.tatoeba_id), [12, 11]);
  assert.deepEqual(Object.keys(e.examples[0]).sort(), ['cantonese', 'english', 'jyutping', 'tatoeba_id']);
  assert.equal(e.examples[0].cantonese, '唔該。');
  assert.equal(e.examples[0].english, 'Thanks.');
  assert.equal(e.examples[0].jyutping, 'm4 goi1');
  assert.ok(!e.examples.some((x) => x.tatoeba_id === 14)); // no English link
});

test('an example is omitted when its Jyutping would be a guess', () => {
  // 晒 and 你 are not in this dictionary, so sentence 11 cannot be read with certainty;
  // sentence 12 is fully covered by the entry itself.
  const e = find(buildEntries(sources({ cccanto: [CANTO[1]], cccedictReadings: [], cedict: [] }), []), '唔該', 'm4 goi1');
  assert.deepEqual(e.examples.map((x) => x.tatoeba_id), [12]);
});

test('a character with two readings in the dictionary is not read in an example', () => {
  const two = sources({
    cccanto: ['行 行 [xing2] {haang4} /to walk/', '行 行 [hang2] {hong4} /row/', '唔該 唔该 [m4 gai1] {m4 goi1} /thank you/'],
    cccedictReadings: [],
    cedict: [],
    tatoeba: [{ id: 21, text: '唔該行。', english: 'Thanks, walk.' }],
  });
  const entries = buildEntries(two, []);
  assert.deepEqual(find(entries, '唔該', 'm4 goi1').examples, []);
  assert.deepEqual(find(entries, '行', 'haang4').examples, []);
});

test('an example must use the entry as a word of its own, not inside a longer word', () => {
  const inner = sources({
    cccanto: ['唔該 唔该 [m4 gai1] {m4 goi1} /thank you/', '該 该 [gai1] {goi1} /ought to/'],
    cccedictReadings: [],
    cedict: [],
    tatoeba: [{ id: 31, text: '唔該。', english: 'Thanks.' }],
  });
  const entries = buildEntries(inner, []);
  assert.equal(find(entries, '唔該', 'm4 goi1').examples.length, 1);
  assert.deepEqual(find(entries, '該', 'goi1').examples, []);
});

test('frequency is a number, higher for words seen more often', () => {
  const entries = buildEntries(sources(), []);
  const a = find(entries, '唔該', 'm4 goi1').frequency;
  const b = find(entries, '無名', 'mou4 ming4').frequency;
  assert.equal(typeof a, 'number');
  assert.ok(a > b);
  assert.equal(b, 0);
});

test('colloquial entries rank above general and written, then by frequency', () => {
  const entries = buildEntries(sources(), []);
  const order = { colloquial: 0, general: 1, written: 2 };
  for (let i = 1; i < entries.length; i++) {
    const [p, q] = [entries[i - 1], entries[i]];
    assert.ok(order[p.register] <= order[q.register]);
    if (p.register === q.register) assert.ok(p.frequency >= q.frequency);
  }
});

test('a correction can change the English, jyutping and register', () => {
  const corrections = [
    { match: { characters: '唔該', jyutping: 'm4 goi1' }, set: { english: ['please', 'thank you'], register: 'general' } },
    { match: { characters: '食飯', jyutping: 'sik6 faan6' }, set: { jyutping: 'sik6 faan2' } },
  ];
  const entries = buildEntries(sources(), corrections);
  const a = find(entries, '唔該', 'm4 goi1');
  assert.deepEqual(a.english, ['please', 'thank you']);
  assert.equal(a.register, 'general');
  const b = find(entries, '食飯', 'sik6 faan2');
  assert.ok(b);
  assert.equal(b.yale, phraseToYale('sik6 faan2'));
  assert.equal(b.toneless_key, 'sik faan');
  assert.equal(find(entries, '食飯', 'sik6 faan6'), undefined);
});

test('a correction still applies after a later source update', () => {
  const corrections = [{ match: { characters: '唔該', jyutping: 'm4 goi1' }, set: { english: ['thank you (corrected)'] } }];
  const v1 = buildEntries(sources(), corrections);
  const updated = sources({ cccanto: ['唔該 唔该 [m4 gai1] {m4 goi1} /thanks reworded by the source/', ...CANTO.slice(2)] });
  const v2 = buildEntries(updated, corrections);
  assert.deepEqual(find(v1, '唔該', 'm4 goi1').english, ['thank you (corrected)']);
  assert.deepEqual(find(v2, '唔該', 'm4 goi1').english, ['thank you (corrected)']);
  assert.deepEqual(find(buildEntries(updated, []), '唔該', 'm4 goi1').english, ['thanks reworded by the source']);
});

test('a hidden entry is absent, and only that reading', () => {
  const two = sources({ cccanto: [...CANTO, '食飯 食饭 [shi2 fan4] {sik6 faan2} /alt/'] });
  const entries = buildEntries(two, [{ match: { characters: '唔該', jyutping: 'm4 goi1' }, hide: true }]);
  assert.equal(find(entries, '唔該', 'm4 goi1'), undefined);
  assert.ok(find(entries, '食飯', 'sik6 faan6'));
});

test('a correction with an invalid jyutping is an error, not a silent entry', () => {
  assert.throws(() => buildEntries(sources(), [{ match: { characters: '唔該', jyutping: 'm4 goi1' }, set: { jyutping: 'zz9' } }]), /invalid/i);
});

test('the report counts entries by register and source', () => {
  const { report } = buildEntriesWithReport(sources(), []);
  assert.equal(report.total, Object.values(report.byRegister).reduce((a, b) => a + b, 0));
  assert.equal(report.bySource['cc-canto'], 5);
  assert.ok(report.withExamples >= 1);
});

test('two entries sharing an id make the build fail with a clear error', () => {
  assert.doesNotThrow(() => assertUniqueIds([{ id: 'a' }, { id: 'b' }]));
  assert.throws(
    () => assertUniqueIds([{ id: 'a', characters: '甲', jyutping: 'gaap3' }, { id: 'a', characters: '乙', jyutping: 'jyut6' }]),
    /Duplicate entry id a: 甲 gaap3 and 乙 jyut6/,
  );
});

const REAL_GLOSS = {
  keoi: sources({
    cccanto: ['佢 佢 [qu2] {keoi5} /he / she / it (Cantonese)/Mandarin equivalent: 他tā [他]/ # adapted from cc-cedict'],
    cccedictReadings: [],
    cedict: [],
  }),
  nei: sources({
    cccanto: ['你 你 [ni3] {nei5} /you (informal, as opposed to courteous 您nín [您])/can be used to refer to an unspecified person/ # adapted from cc-cedict'],
    cccedictReadings: [],
    cedict: [],
  }),
  zo: sources({
    cccanto: [],
    cccedictReadings: ['咗 咗 [zuo3] {zo2}'],
    cedict: ['咗 咗 [zuo3] /Cantonese particle equivalent to 了[le5] or 過|过[guo4]/'],
  }),
  matje: sources({
    cccanto: [],
    cccedictReadings: ['乜嘢 乜嘢 [mie1 ye3] {mat1 je5}'],
    cedict: ['乜嘢 乜嘢 [mie1 ye3] /what? (Cantonese) (Mandarin equivalent: 什麼|什么[shen2 me5])/'],
  }),
};

test('cross-references are dropped from English: 佢, 你, 咗 and 乜嘢 from their real source lines', () => {
  const english = (key, chars, jy) => find(buildEntries(REAL_GLOSS[key], []), chars, jy).english;
  assert.deepEqual(english('keoi', '佢', 'keoi5'), ['he', 'she', 'it (Cantonese)']);
  assert.deepEqual(english('nei', '你', 'nei5'), ['you', 'can be used to refer to an unspecified person']);
  assert.deepEqual(english('zo', '咗', 'zo2'), ['Cantonese particle']);
  assert.deepEqual(english('matje', '乜嘢', 'mat1 je5'), ['what? (Cantonese)']);
});

test('cleanEnglish: segments, characters, brackets and notes', () => {
  assert.deepEqual(cleanEnglish(['classifier; CL:個|个[ge4]', 'variant of 你[ni3]', 'see 你[ni3]', 'also written 嗰[ge3]']), ['classifier']);
  assert.deepEqual(cleanEnglish(['to eat 食 fast (coll.)']), ['to eat fast (coll.)']);
  assert.deepEqual(cleanEnglish(['嗰 only', '的 ()', '的 a', 'a | b [] c']), ['only', 'a b c']);
  assert.deepEqual(cleanEnglish(['  spaced   out ; ']), ['spaced out']);
});

test('an entry whose English is all cross-reference is kept with no English, and counted', () => {
  const only = sources({ cccanto: ['嘅 嘅 [ge3] {ge3} /variant of 嘅[ge3]/'], cccedictReadings: [], cedict: [] });
  const { entries, report } = buildEntriesWithReport(only, []);
  assert.deepEqual(find(entries, '嘅', 'ge3').english, []);
  assert.equal(report.emptiedByCleaning, 1);
});

test('no entry has Chinese characters, brackets or a bar in its English; a correction is not cleaned', () => {
  const entries = buildEntries(sources({ cedict: [...CEDICT, '食飯 食饭 [shi2 fan4] /to eat 飯[fan4] | rice/'] }), []);
  for (const e of entries) for (const m of e.english) assert.doesNotMatch(m, /[\p{Script=Han}\[\]|]/u);
  assert.throws(() => assertCleanEnglish([{ id: 'x1', characters: 'a', jyutping: 'a1', english: ['ta []'] }]), /x1/);
  assert.throws(() => assertCleanEnglish([{ id: 'x2', characters: 'a', jyutping: 'a1', english: ['他'] }]), /x2/);
  // set.english wins and is used as written, so the final assertion catches a bad correction
  assert.throws(() => buildEntries(sources(), [{ match: { characters: '唔該', jyutping: 'm4 goi1' }, set: { english: ['bad 他'] } }]), /unclean English/);
});
