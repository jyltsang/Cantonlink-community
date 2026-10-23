// Cross-checks every reading in content/ against an independent Cantonese
// pronunciation dictionary (to-jyutping, by CanCLID), reading each sentence in
// context. A word whose Jyutping differs from the dictionary's first choice
// must be explained in content/pronunciation-notes.json; usually it is a
// colloquial reading such as 坐 co5 or a changed tone such as 慢慢 maan6 maan2.
// Fails on unexplained differences and on notes that no longer apply.

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import ToJyutping from 'to-jyutping';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (path) => JSON.parse(readFileSync(join(ROOT, path), 'utf8'));
const HAN = /\p{Script=Han}/u;

// Every place readings appear, as [where, [[characters, Jyutping] or [mark], …]].
function sources() {
  const out = [];
  for (const level of ['A1', 'A2', 'B1']) {
    for (const p of readJson(`content/grammar/${level}.json`)) {
      p.examples.forEach((ex, i) => out.push([`${p.id} example ${i + 1}`, ex.words]));
      (p.mistakes ?? []).forEach((m, i) => out.push([`${p.id} mistake ${i + 1}`, m.correct]));
    }
  }
  for (const file of readdirSync(join(ROOT, 'content/vocabulary')).filter((f) => f.endsWith('.json'))) {
    const topic = readJson(`content/vocabulary/${file}`);
    for (const w of topic.words) {
      out.push([`${topic.id}/${w.cjk}`, [[w.cjk, w.jyutping]]]);
      if (w.classifier) out.push([`${topic.id}/${w.cjk} classifier`, [w.classifier]]);
    }
  }
  readJson('content/practice/spoken-or-written.json').items.forEach((item, i) => out.push([`spoken-or-written ${i + 1}`, item.spoken]));
  for (const u of readJson('content/path.json').units) out.push([`path/${u.id} title`, [[u.titleCjk, u.titleJyutping]]]);
  for (const d of readJson('content/dialogues.json').dialogues) d.lines.forEach((line, i) => out.push([`dialogue/${d.unit} line ${i + 1}`, line.words]));
  for (const [cjk, jyutping] of readJson('content/lexicon.json').words) out.push([`lexicon/${cjk}`, [[cjk, jyutping]]]);
  return out;
}

// Compares one sentence word by word with the dictionary's reading in context.
export function compare(words) {
  const spoken = words.filter((w) => w.length === 2);
  const reference = ToJyutping.getJyutpingList(spoken.map((w) => w[0]).join('')).filter(([c]) => HAN.test(c)).map(([, j]) => j);
  const differences = [];
  let k = 0;
  for (const [cjk, jyutping] of spoken) {
    const ours = jyutping.split(' ').filter((s) => /\d$/.test(s));
    const theirs = ours.map((_, i) => reference[k + i]);
    k += ours.length;
    if (ours.join(' ') !== theirs.join(' ')) differences.push({ cjk, ours: ours.join(' '), reference: theirs.join(' ') });
  }
  return differences;
}

export function check(notes = readJson('content/pronunciation-notes.json').notes) {
  const noteFor = new Map(notes.map((n) => [`${n.cjk}|${n.jyutping}`, n]));
  const used = new Set();
  const problems = [];
  let checked = 0;
  for (const [where, words] of sources()) {
    checked++;
    for (const d of compare(words)) {
      const key = `${d.cjk}|${d.ours}`;
      if (noteFor.has(key)) used.add(key);
      else problems.push(`${where}: ${d.cjk} is "${d.ours}" here; the reference dictionary reads "${d.reference}". Fix it, or explain it in content/pronunciation-notes.json.`);
    }
  }
  for (const n of notes) {
    if (!n.reason?.trim()) problems.push(`pronunciation note for ${n.cjk} needs a reason`);
    if (!used.has(`${n.cjk}|${n.jyutping}`)) problems.push(`pronunciation note for ${n.cjk} "${n.jyutping}" no longer matches any difference; remove it`);
  }
  return { checked, problems, notes: notes.length };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { checked, problems, notes } = check();
  if (problems.length) {
    console.error(`✗ ${problems.length} pronunciation problem(s):\n  ${problems.join('\n  ')}`);
    process.exit(1);
  }
  console.log(`✓ ${checked} entries agree with the reference dictionary (${notes} documented colloquial readings)`);
}
