import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildLexicon, checkWordAlignment } from './library.mjs';
import { verify, badgeFor, parseReply, checkLearnerText, SCHEMAS } from './ai-checks.mjs';

const data = JSON.parse(readFileSync(new URL('../dist/cantonlink-community.json', import.meta.url), 'utf8'));
const ctx = { data, lexicon: buildLexicon(data) };
const reply = (words, extra = {}) => JSON.stringify({ reply: { words, en: 'test' }, correction: null, patterns: [], note: '', ...extra });
const W = (text) => text.split(' ').map((t) => {
  const [cjk, jp = ''] = t.split('/');
  return { cjk, jyutping: jp.replaceAll('-', ' ') };
});
const step = (result, id) => result.steps.find((s) => s.id === id);

test('a clean reply is Verified, with romanisation generated locally', () => {
  const r = verify('tutor', reply(W('你/nei5 食咗/sik6-zo2 飯/faan6 未/mei6 呀/aa3 ？')), ctx);
  assert.equal(badgeFor(r), 'verified');
  assert.equal(r.value.reply.cjk, '你食咗飯未呀？');
  assert.equal(r.value.reply.tokens[1].yale, 'sihk jó');
  assert.equal(r.value.reply.tokens.at(-1).punctuation, '?');
  assert.equal(step(r, 'romanisation').status, 'pass');
});

test('malformed JSON fails the structure check and asks for a retry', () => {
  const r = verify('tutor', 'Sure! 你好', ctx);
  assert.equal(step(r, 'structure').status, 'fail');
  assert.equal(step(r, 'jyutping').status, 'skip');
  assert.ok(r.retryFeedback);
  assert.equal(badgeFor(r), 'unverified');
});

test('code fences around JSON are accepted', () => {
  assert.ok(parseReply('```json\n{"a":1}\n```').value);
});

test('invalid Jyutping fails and is reported', () => {
  const r = verify('tutor', reply(W('你/nei7 好/hou2')), ctx);
  assert.equal(step(r, 'jyutping').status, 'fail');
  assert.match(step(r, 'jyutping').detail, /"nei7" in 你/);
  assert.match(r.retryFeedback, /Valid Jyutping/);
});

test('a character and syllable mismatch fails alignment', () => {
  const r = verify('tutor', reply(W('食咗/sik6 飯/faan6')), ctx);
  assert.equal(step(r, 'alignment').status, 'fail');
  assert.match(step(r, 'alignment').detail, /食咗 has 2 characters but 1 syllable/);
});

test('written Chinese is flagged', () => {
  const r = verify('tutor', reply(W('他/taa1 是/si6 學生/hok6-saang1')), ctx);
  assert.equal(step(r, 'spoken').status, 'fail');
  assert.match(step(r, 'spoken').detail, /"他" \(say 佢\)/);
  assert.equal(badgeFor(r), 'unverified');
});

test('a library word with the wrong tone gets the library reading: Corrected', () => {
  const r = verify('tutor', reply(W('我/ngo5 係/hai6 學生/hok6-saang2')), ctx);
  assert.equal(step(r, 'library').status, 'fixed');
  assert.equal(r.value.reply.tokens[2].jyutping, 'hok6 saang1');
  assert.equal(r.value.reply.tokens[2].corrected, true);
  assert.equal(badgeFor(r), 'corrected');
});

test('a single character with a different reading is only noted', () => {
  const r = verify('tutor', reply(W('我/ngo5 好/hou3 鍾意/zung1-ji3')), ctx);
  assert.equal(step(r, 'library').status, 'warn');
  assert.equal(r.value.reply.tokens[1].jyutping, 'hou3');
  assert.equal(badgeFor(r), 'verified');
});

test('an invented pattern id is removed', () => {
  const r = verify('tutor', reply(W('我/ngo5 食咗/sik6-zo2'), { patterns: ['zo2-completed', 'made-up-pattern'] }), ctx);
  assert.equal(step(r, 'patterns').status, 'fixed');
  assert.deepEqual(r.value.patterns, ['zo2-completed']);
});

test('corrections are checked too', () => {
  const r = verify('tutor', reply(W('好/hou2'), { correction: { learner_said: '我不去', better: { words: W('我/ngo5 不/bat1 去/heoi3'), en: 'x' }, explanation: 'x', pattern_id: 'm4-negation' } }), ctx);
  assert.equal(step(r, 'spoken').status, 'fail');
});

test('a retry that fixes things is Corrected', () => {
  const r = verify('sentence', JSON.stringify({ words: W('多謝/do1-ze6'), en: 'thanks' }), ctx);
  assert.equal(badgeFor(r, { retried: true }), 'corrected');
});

test('code-mixed English words are allowed', () => {
  assert.equal(checkWordAlignment('寫code', 'se2 code').ok, true);
  assert.equal(checkWordAlignment('出bug', 'ceot1 bug').ok, true);
  assert.equal(checkWordAlignment('寫code', 'se2').ok, true);
  assert.equal(checkWordAlignment('寫', 'se2 ko1').ok, false);
});

test('explain replies check every example', () => {
  const r = verify('explain', JSON.stringify({ explanation: 'x', examples: [{ words: W('佢/keoi5 是/si6'), en: 'x' }] }), ctx);
  assert.equal(step(r, 'spoken').status, 'fail');
});

test('learner text: written forms and bad Jyutping are noted', () => {
  assert.match(checkLearnerText('我不知道').join(), /"不" is written Chinese/);
  assert.match(checkLearnerText('ngo5 hou7').join(), /hou7/);
  assert.deepEqual(checkLearnerText('ngo5 hou2 hoi1 sam1'), []);
});

test('schemas are valid structured-output schemas (objects closed)', () => {
  const walk = (s) => {
    if (s.type === 'object') assert.equal(s.additionalProperties, false);
    for (const v of Object.values(s.properties ?? {})) walk(v);
    if (s.items) walk(s.items);
    for (const v of s.anyOf ?? []) walk(v);
  };
  Object.values(SCHEMAS).forEach(walk);
});
