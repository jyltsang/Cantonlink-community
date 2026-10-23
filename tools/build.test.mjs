// Runs the build's validation on a modified copy of content/ to prove that
// each rule rejects what it should.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = fileURLToPath(new URL('..', import.meta.url));

function validate(change) {
  const root = mkdtempSync(join(tmpdir(), 'cantonlink-build-'));
  try {
    cpSync(join(REPO, 'content'), join(root, 'content'), { recursive: true });
    const edit = (path, fn) => {
      const file = join(root, 'content', path);
      const data = JSON.parse(readFileSync(file, 'utf8'));
      fn(data);
      writeFileSync(file, JSON.stringify(data));
    };
    change?.(edit);
    const run = spawnSync(process.execPath, [join(REPO, 'tools/build.mjs'), '--check'], { env: { ...process.env, CANTONLINK_ROOT: root }, encoding: 'utf8' });
    return run.stderr + run.stdout;
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

const example = (data, id, i) => data.find((p) => p.id === id).examples[i];

test('the real content passes validation', () => {
  assert.match(validate(), /Content valid|Generated files are out of date|generated files are up to date/);
  assert.doesNotMatch(validate(), /content error/);
});

test('an accepted word order must use exactly the same words', () => {
  const out = validate((edit) => edit('grammar/A1.json', (d) => { example(d, 'ding6-hai6-or', 0).accept = [['你', '飲', '咖啡', '定係', '奶茶', '呀']]; }));
  assert.match(out, /accepted order "你 飲 咖啡 定係 奶茶 呀" must use exactly the sentence's words/);
});

test('an accepted word order may not repeat the sentence', () => {
  const out = validate((edit) => edit('grammar/A1.json', (d) => { example(d, 'ding6-hai6-or', 0).accept = [['你', '飲', '茶', '定係', '咖啡', '呀']]; }));
  assert.match(out, /repeats the sentence/);
});

test('a distractor may not appear in the sentence or mean the same as the answer', () => {
  const inSentence = validate((edit) => edit('grammar/A1.json', (d) => { example(d, 'hai6-copula', 0).gap.distractors = ['我', '有', '嘅']; }));
  assert.match(inSentence, /distractor "我" already appears in the sentence/);
  const same = validate((edit) => edit('grammar/A1.json', (d) => { example(d, 'mat1-je5-what', 1).gap.distractors = ['乜嘢', '幾', '點']; }));
  assert.match(same, /distractor "乜嘢" means the same as the answer "咩"/);
});

test('written Chinese and misaligned Jyutping are rejected', () => {
  const out = validate((edit) => edit('grammar/A1.json', (d) => {
    example(d, 'hai6-copula', 0).words = [['我', 'ngo5'], ['是', 'si6'], ['學生', 'hok6'], ['。']];
  }));
  assert.match(out, /"學生" has 2 characters but "hok6" has 1 syllables/);
  assert.match(out, /是/);
});

test('the learning path must teach every pattern', () => {
  const out = validate((edit) => edit('path.json', (d) => { d.units[0].patterns = d.units[0].patterns.filter((id) => id !== 'hai6-copula'); }));
  assert.match(out, /"hai6-copula" is not in any unit/);
});

test('dialogues: written Chinese, a missing unit and too few patterns are rejected', () => {
  const written = validate((edit) => edit('dialogues.json', (d) => { d.dialogues[0].lines[2].words = [['你', 'nei5'], ['是', 'si6'], ['學生', 'hok6 saang1'], ['嗎', 'maa3'], ['？']]; }));
  assert.match(written, /dialogue\/u01 line 3/);
  const missing = validate((edit) => edit('dialogues.json', (d) => { d.dialogues = d.dialogues.filter((x) => x.unit !== 'u05'); }));
  assert.match(missing, /path\/u05: has no dialogue/);
  const thin = validate((edit) => edit('dialogues.json', (d) => {
    const lines = d.dialogues[1].lines;
    d.dialogues[1].lines = Array.from({ length: 6 }, (_, i) => ({ ...lines[0], words: [['你好', 'nei5 hou2'], ['！']], en: 'Hello!', speaker: i % 2 ? 'B' : 'A' }));
  }));
  assert.match(thin, /dialogue\/u02: uses 0 of the unit's patterns/);
});
