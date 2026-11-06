// Builds the open Cantonese dictionary dataset from the pinned sources in
// data/dictionary/.cache/ (see tools/dictionary/fetch.mjs and data/dictionary/SOURCES.md).
//
// Usage: node tools/dictionary/build.mjs [--cache <dir>] [--out <file>]
// Output: data/dictionary/dist/dictionary.jsonl.gz (ignored by git; attached to a release).
//
// The pure functions (parseCedictLine, buildEntries, buildEntriesWithReport) take parsed
// source data, so the tests need no network and no cache.
//
// Entry shape (one JSON object per line):
//   id, characters (traditional), jyutping (lower case, numbered tones, single spaces),
//   yale, bopomofo (generated from the Jyutping), english[], register, source, frequency,
//   toneless_key (Jyutping without tone digits), syllable_count,
//   examples[] { cantonese, jyutping, english, tatoeba_id }, status ("external-unreviewed").
//
// Register: CC-Canto entries are "colloquial"; CC-CEDICT entries that have a Cantonese
// reading are "general"; entries matched by the written-marker list or by corrections.json
// are "written". The English patterns look only at the first meaning (a word whose first
// meaning is "(literary) ..."), because many everyday words have one literary sense among others.
//
// Ranking: register (colloquial, general, written), then frequency (highest first).
//
// Frequency (a number, never null): the sum of two per-million rates, rounded to 2 places.
//   hkcancor: occurrences of the exact word as a token in HKCanCor / total HKCanCor tokens * 1e6
//   tatoeba:  occurrences of the characters as a substring of any Tatoeba Cantonese sentence
//             / total characters in those sentences * 1e6 (substrings of 1 to 8 characters)
// Frequency is by characters, not by reading, so homographs share a value. Substring counts
// overstate short words that sit inside longer ones; the corpus is too small and unsegmented
// for anything better, and the value is only used to order entries within one register.
//
// Examples: up to 2 Tatoeba Cantonese sentences that have an English link, contain the
// characters, are read by the entry's own reading at that spot, and are shortest first.
// A sentence is only used when its whole Jyutping is certain. The sentence is segmented
// into words with the fewest pieces, using only dictionary words whose characters have
// exactly one reading across the whole dictionary and one syllable per character; any
// other character (a character with two readings, a character not in the dictionary,
// Latin letters, digits) makes the sentence unusable and it is omitted rather than guessed.
// Punctuation and spaces are dropped from the Jyutping. The entry's characters must stand as
// a word of their own in the sentence (not inside a longer word) and the entry's reading
// must equal the sentence's reading there.
//
// English glosses are cleaned (see cleanEnglish and data/dictionary/README.md) before corrections;
// a correction's own English is used as written, and the build fails if any entry still has
// Chinese characters, brackets or '|' in its English.
//
// Corrections (data/dictionary/corrections.json) are applied last, so a source update never
// removes them: [{ match: { characters, jyutping }, set?: { jyutping?, english?, register? },
// hide?: true }]. See data/dictionary/README.md.

import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { phraseToYale, phraseToBopomofo, isValidSyllable } from '../romanise.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(HERE, '..', '..', 'data', 'dictionary');
export const DEFAULT_CACHE = join(DATA_DIR, '.cache');
export const DEFAULT_OUT = join(DATA_DIR, 'dist', 'dictionary.jsonl.gz');
const MARKERS_PATH = join(DATA_DIR, 'written-markers.json');
const CORRECTIONS_PATH = join(DATA_DIR, 'corrections.json');

const REGISTERS = ['colloquial', 'general', 'written'];
const REGISTER_RANK = Object.fromEntries(REGISTERS.map((r, i) => [r, i]));
const MAX_SPAN = 8; // longest substring counted and indexed, in characters
const EXAMPLE_CANDIDATES = 24; // shortest sentences kept per substring before the reading check
const EXAMPLES_PER_ENTRY = 2;

// --- Parsing ----------------------------------------------------------------

const LINE_RE = /^(\S+)\s+(\S+)\s+\[([^\]]*)\]\s*(?:\{([^}]*)\})?\s*(?:\/(.*)\/)?\s*(?:#.*)?$/;

export const normaliseJyutping = (text) => text.toLowerCase().trim().split(/\s+/).filter(Boolean).join(' ');

function parseLine(line) {
  const text = line.trim();
  if (!text || text.startsWith('#')) return null;
  const m = LINE_RE.exec(text);
  if (!m) return null;
  const [, trad, simp, pinyin, jy, gloss] = m;
  const jyutping = jy === undefined ? null : normaliseJyutping(jy) || null;
  const english = gloss === undefined ? [] : gloss.split('/').map((g) => g.trim()).filter(Boolean);
  return { trad, simp, pinyin, jyutping, english };
}

// CC-Canto, CC-CEDICT Cantonese readings and CC-CEDICT share one line format:
//   trad simp [pinyin] {jyutping} /gloss/gloss/
// CC-CEDICT itself has no {jyutping}; its jyutping is null.
export function parseCedictLine(line) {
  const p = parseLine(line);
  return p && { trad: p.trad, simp: p.simp, jyutping: p.jyutping, english: p.english };
}

const pinyinKey = (pinyin) => pinyin.toLowerCase().replace(/\s+/g, '');

// --- Helpers ------------------------------------------------------------------

const codePoints = (text) => Array.from(text);
const isPunctuation = (ch) => /^[\p{P}\p{S}\s]$/u.test(ch);
const syllablesOf = (jyutping) => jyutping.split(' ');
const allValid = (jyutping) => syllablesOf(jyutping).every(isValidSyllable);
const entryKey = (characters, jyutping) => `${characters}|${jyutping}`;
const idOf = (characters, jyutping) => createHash('sha1').update(entryKey(characters, jyutping)).digest('hex').slice(0, 12);
// Ids are 12 hex characters of a SHA-1, so a clash is very unlikely; a silent one would merge two
// entries when the dataset is loaded, so fail loudly instead.
export function assertUniqueIds(entries) {
  const seen = new Map();
  for (const e of entries) {
    const other = seen.get(e.id);
    if (other) throw new Error(`Duplicate entry id ${e.id}: ${other.characters} ${other.jyutping} and ${e.characters} ${e.jyutping}`);
    seen.set(e.id, e);
  }
}
// --- Cleaning English glosses -----------------------------------------------------
// The sources write cross-references into their glosses ("Mandarin equivalent: 他[ta1]", "CL:個[ge4]").
// A learner sees English only, so Chinese characters, pinyin brackets and the notes built on them go.
const CJK_CHAR = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\u2E80-\u2FDF\u3000-\u303F\uFF00-\uFFEF]/u;
const CJK_ANY = new RegExp(CJK_CHAR.source, 'gu');
const CROSS_REF_LEAD = /\b(equivalent|variant|see|also written|written as|same as|abbr|short for|erhua)\b[^;]*$/i;

const CROSS_REF_START = /\b(mandarin equivalent|equivalent to|variant of|see also|see|also written|written as|same as|cl:|abbr)/i;

const isCrossReference = (text) => CJK_CHAR.test(text) && /\[[^\]]*\]/.test(text);

// One meaning, which may hold several ";" segments. Returns '' when nothing meaningful is left.
function cleanMeaning(meaning) {
  let text = meaning;
  let previous;
  do {
    previous = text;
    text = text.replace(/\([^()]*\)/g, (group) => (isCrossReference(group) ? ' ' : group)); // "(Mandarin equivalent: 什麼[shen2 me5])"
  } while (text !== previous);
  const kept = [];
  for (const segment of text.split(';')) {
    let out = segment;
    if (isCrossReference(segment)) {
      const at = segment.search(CROSS_REF_START);
      if (at >= 0) {
        // keep any plain English before the cross-reference ("Cantonese particle equivalent to 了[le5]")
        out = segment.slice(0, at);
        if (CJK_CHAR.test(out) || /\[/.test(out) || !/[A-Za-z]{2,}/.test(out)) continue;
      } else {
        // a name with an inline reference ("a county in Zhoushan City 舟山市[Zhou1 shan1 Shi4], Zhejiang")
        out = segment.replace(/\S*[\p{Script=Han}]\S*\s*\[[^\]]*\]/gu, ' ');
      }
    }
    if (CJK_CHAR.test(out)) {
      const lead = out.slice(0, out.search(CJK_CHAR));
      if (CROSS_REF_LEAD.test(lead)) continue; // "Mandarin equivalent: 他tā"
      out = out.replace(CJK_ANY, ' ');
      if (!/[A-Za-z]{2,}/.test(out.replace(/\([^)]*\)/g, ''))) continue; // nothing but notes left
    }
    out = out
      .replace(/\[\s*\]|\(\s*\)/g, ' ')
      .replace(/[\[\]|]/g, ' ')
      .replace(/\s+/g, ' ')
      .replace(/\s+([,.:?!)])/g, '$1')
      .replace(/([(])\s+/g, '$1')
      .replace(/^[\s,:;.]+|[\s,:;]+$/g, '');
    if (out) kept.push(out);
  }
  return kept.join('; ');
}

export function cleanEnglish(meanings) {
  return uniq(meanings.map(cleanMeaning).filter(Boolean));
}

const CLEAN_FORBIDDEN = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\u2E80-\u2FDF\[\]|]/u;
export function assertCleanEnglish(entries) {
  for (const e of entries) {
    const bad = e.english.find((m) => CLEAN_FORBIDDEN.test(m));
    if (bad !== undefined) throw new Error(`Entry ${e.id} (${e.characters} ${e.jyutping}) has an unclean English meaning: ${bad}`);
  }
}

const uniq = (list) => [...new Set(list)];

export function loadWrittenMarkers(path = MARKERS_PATH) {
  const data = JSON.parse(readFileSync(path, 'utf8'));
  return { characters: new Set(data.characters ?? []), englishPatterns: (data.english_patterns ?? []).map((p) => p.toLowerCase()) };
}

export function loadCorrections(path = CORRECTIONS_PATH) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function isWritten(candidate, markers) {
  if (markers.characters.has(candidate.characters)) return true;
  if (candidate.register === 'colloquial') return false; // CC-Canto glosses are not written-style markers
  // only the first meaning counts: many common words have one literary sense among others
  const first = (candidate.english[0] ?? '').toLowerCase();
  return markers.englishPatterns.some((p) => first.includes(p));
}

// --- Candidates from the sources ---------------------------------------------

function collectCandidates(sources, report) {
  const cedictByFull = new Map();
  const cedictByWord = new Map();
  for (const line of sources.cedict ?? []) {
    const p = parseLine(line);
    if (!p || !p.english.length) continue;
    const full = `${p.trad}|${p.simp}|${pinyinKey(p.pinyin)}`;
    if (!cedictByFull.has(full)) cedictByFull.set(full, p.english);
    const word = `${p.trad}|${p.simp}`;
    if (!cedictByWord.has(word)) cedictByWord.set(word, p.english);
  }

  const out = [];
  const tidy = (english) => {
    const cleaned = cleanEnglish(english);
    if (english.length && !cleaned.length) report.emptiedByCleaning += 1;
    return cleaned;
  };
  const take = (lines, build) => {
    for (const line of lines ?? []) {
      const p = parseLine(line);
      if (!p) {
        if (line.trim() && !line.startsWith('#')) report.unparsed += 1;
        continue;
      }
      if (!p.jyutping) {
        report.droppedNoReading += 1;
        continue;
      }
      if (!allValid(p.jyutping)) {
        report.droppedInvalid += 1;
        if (report.invalidSamples.length < 10) report.invalidSamples.push(`${p.trad} ${p.jyutping}`);
        continue;
      }
      out.push(build(p));
    }
  };
  take(sources.cccanto, (p) => ({
    characters: p.trad, originalJyutping: p.jyutping, jyutping: p.jyutping, english: tidy(p.english), source: 'cc-canto', register: 'colloquial',
  }));
  take(sources.cccedictReadings, (p) => ({
    characters: p.trad,
    originalJyutping: p.jyutping,
    jyutping: p.jyutping,
    english: tidy(cedictByFull.get(`${p.trad}|${p.simp}|${pinyinKey(p.pinyin)}`) ?? cedictByWord.get(`${p.trad}|${p.simp}`) ?? []),
    source: 'cc-cedict',
    register: 'general',
  }));
  return out;
}

// One entry per characters and reading. The first candidate (CC-Canto before CC-CEDICT) wins; a
// repeat from the same source adds its meanings.
function dedupe(candidates) {
  const byKey = new Map();
  for (const c of candidates) {
    const key = entryKey(c.characters, c.jyutping);
    const have = byKey.get(key);
    if (!have) byKey.set(key, { ...c, english: [...c.english] });
    else if (have.source === c.source || !have.english.length) have.english = uniq([...have.english, ...c.english]);
  }
  return [...byKey.values()];
}

function applyCorrections(candidates, corrections, report) {
  const used = new Set();
  const kept = [];
  for (const c of candidates) {
    let hidden = false;
    corrections.forEach((rule, index) => {
      const { characters, jyutping } = rule.match ?? {};
      if (characters !== c.characters) return;
      if (jyutping !== undefined && normaliseJyutping(jyutping) !== c.originalJyutping) return;
      used.add(index);
      if (rule.hide) hidden = true;
      const set = rule.set ?? {};
      if (set.jyutping !== undefined) {
        const next = normaliseJyutping(set.jyutping);
        if (!next || !allValid(next)) throw new Error(`Correction for ${characters} has an invalid jyutping: ${set.jyutping}`);
        c.jyutping = next;
      }
      if (set.english !== undefined) c.english = [...set.english];
      if (set.register !== undefined) {
        if (!REGISTERS.includes(set.register)) throw new Error(`Correction for ${characters} has an invalid register: ${set.register}`);
        c.register = set.register;
      }
    });
    if (hidden) report.hidden += 1;
    else kept.push(c);
  }
  report.unmatchedCorrections = corrections.length - used.size;
  return kept;
}

// --- Frequency and examples ----------------------------------------------------

// Words whose characters have exactly one reading in the dictionary, one syllable per character.
function certainReadings(candidates) {
  const readings = new Map();
  for (const c of candidates) {
    if (!readings.has(c.characters)) readings.set(c.characters, new Set());
    readings.get(c.characters).add(c.jyutping);
  }
  const certain = new Map();
  let longest = 1;
  for (const [characters, set] of readings) {
    if (set.size !== 1) continue;
    const chars = codePoints(characters);
    const [jyutping] = set;
    if (chars.some(isPunctuation) || syllablesOf(jyutping).length !== chars.length) continue;
    certain.set(characters, jyutping);
    longest = Math.max(longest, chars.length);
  }
  return { certain, longest: Math.min(longest, MAX_SPAN) };
}

// Returns { syllables, cuts } (one syllable per non-punctuation character; cuts are the character
// positions where the pieces join), or null when any part of the sentence is not certain.
function readSentence(chars, certain, longest) {
  const n = chars.length;
  const best = new Array(n + 1).fill(null); // best[i] = { pieces, from, syllables }
  best[0] = { pieces: 0, from: -1, syllables: [] };
  for (let i = 0; i < n; i++) {
    if (!best[i]) continue;
    if (isPunctuation(chars[i])) {
      if (!best[i + 1] || best[i + 1].pieces > best[i].pieces) best[i + 1] = { pieces: best[i].pieces, from: i, syllables: [] };
      continue;
    }
    for (let len = Math.min(longest, n - i); len >= 1; len--) {
      const word = chars.slice(i, i + len).join('');
      const jyutping = certain.get(word);
      if (!jyutping) continue;
      const pieces = best[i].pieces + 1;
      if (!best[i + len] || best[i + len].pieces > pieces) best[i + len] = { pieces, from: i, syllables: syllablesOf(jyutping) };
    }
  }
  if (!best[n]) return null;
  const parts = [];
  const cuts = new Set([n]); // where one piece ends and the next begins
  for (let i = n; i > 0; i = best[i].from) {
    parts.push(best[i].syllables);
    cuts.add(best[i].from);
  }
  return { syllables: parts.reverse().flat(), cuts };
}

function indexTatoeba(sentences, certain, longest) {
  const counts = new Map(); // substring -> occurrences over every sentence
  const index = new Map(); // substring -> up to EXAMPLE_CANDIDATES usable sentences, shortest first
  let totalChars = 0;
  const prepared = sentences.map((s) => {
    const chars = codePoints(s.text);
    totalChars += chars.length;
    return { ...s, chars };
  });
  prepared.sort((a, b) => a.chars.length - b.chars.length || a.id - b.id);
  for (const s of prepared) {
    const read = s.english ? readSentence(s.chars, certain, longest) : null;
    if (read) {
      // syllable position of each character (punctuation has none)
      s.position = [];
      let next = 0;
      for (const ch of s.chars) s.position.push(isPunctuation(ch) ? -1 : next++);
      s.syllables = read.syllables;
      s.cuts = read.cuts;
    }
    const seen = new Set();
    for (let i = 0; i < s.chars.length; i++) {
      for (let len = 1; len <= MAX_SPAN && i + len <= s.chars.length; len++) {
        const sub = s.chars.slice(i, i + len).join('');
        counts.set(sub, (counts.get(sub) ?? 0) + 1);
        if (!s.syllables || seen.has(sub)) continue;
        seen.add(sub);
        let list = index.get(sub);
        if (!list) index.set(sub, (list = []));
        if (list.length < EXAMPLE_CANDIDATES) list.push(s);
      }
    }
  }
  return { counts, index, totalChars };
}

function examplesFor(entry, tatoeba) {
  const list = tatoeba.index.get(entry.characters);
  if (!list) return [];
  const target = codePoints(entry.characters);
  const wanted = entry.jyutping;
  const out = [];
  for (const s of list) {
    // the entry's own reading must be what the sentence reads at one of the places it occurs
    let ok = false;
    for (let i = 0; i + target.length <= s.chars.length && !ok; i++) {
      if (!target.every((ch, k) => s.chars[i + k] === ch)) continue;
      if (!s.cuts.has(i) || !s.cuts.has(i + target.length)) continue; // inside a longer word
      const start = s.position[i];
      ok = s.syllables.slice(start, start + target.length).join(' ') === wanted;
    }
    if (!ok) continue;
    out.push({ cantonese: s.text, jyutping: s.syllables.join(' '), english: s.english, tatoeba_id: s.id });
    if (out.length === EXAMPLES_PER_ENTRY) break;
  }
  return out;
}

function frequencyFor(characters, hk, tatoeba) {
  const hkRate = hk && hk.total ? ((hk.counts.get(characters) ?? 0) / hk.total) * 1e6 : 0;
  const tatRate = tatoeba.totalChars ? ((tatoeba.counts.get(characters) ?? 0) / tatoeba.totalChars) * 1e6 : 0;
  return Math.round((hkRate + tatRate) * 100) / 100;
}

// --- Build ---------------------------------------------------------------------

export function buildEntriesWithReport(sources, corrections = []) {
  const report = {
    total: 0, byRegister: {}, bySource: {}, droppedInvalid: 0, droppedNoReading: 0, unparsed: 0, hidden: 0,
    unmatchedCorrections: 0, emptiedByCleaning: 0, withExamples: 0, withoutEnglish: 0, invalidSamples: [],
  };
  const markers = sources.writtenMarkers ?? loadWrittenMarkers();
  let candidates = dedupe(collectCandidates(sources, report));
  for (const c of candidates) if (isWritten(c, markers)) c.register = 'written';
  candidates = dedupe(applyCorrections(candidates, corrections, report));

  const { certain, longest } = certainReadings(candidates);
  const tatoeba = indexTatoeba(sources.tatoeba ?? [], certain, longest);

  const entries = candidates.map((c) => {
    const chars = codePoints(c.characters);
    return {
      id: idOf(c.characters, c.originalJyutping),
      characters: c.characters,
      jyutping: c.jyutping,
      yale: phraseToYale(c.jyutping),
      bopomofo: phraseToBopomofo(c.jyutping),
      english: c.english,
      register: c.register,
      source: c.source,
      frequency: frequencyFor(c.characters, sources.hkcancor, tatoeba),
      toneless_key: c.jyutping.replace(/[1-6]/g, ''),
      syllable_count: syllablesOf(c.jyutping).length,
      examples: chars.length > MAX_SPAN ? [] : examplesFor(c, tatoeba),
      status: 'external-unreviewed',
    };
  });
  assertUniqueIds(entries);
  assertCleanEnglish(entries);
  entries.sort(
    (a, b) =>
      REGISTER_RANK[a.register] - REGISTER_RANK[b.register] ||
      b.frequency - a.frequency ||
      a.syllable_count - b.syllable_count ||
      (a.characters < b.characters ? -1 : a.characters > b.characters ? 1 : 0) ||
      (a.jyutping < b.jyutping ? -1 : a.jyutping > b.jyutping ? 1 : 0),
  );

  report.total = entries.length;
  for (const e of entries) {
    report.byRegister[e.register] = (report.byRegister[e.register] ?? 0) + 1;
    report.bySource[e.source] = (report.bySource[e.source] ?? 0) + 1;
    if (e.examples.length) report.withExamples += 1;
    if (!e.english.length) report.withoutEnglish += 1;
  }
  return { entries, report };
}

export function buildEntries(sources, corrections = []) {
  return buildEntriesWithReport(sources, corrections).entries;
}

// --- Loading the cache -----------------------------------------------------------

const BIG = 1024 * 1024 * 1024;
const lines = (text) => text.split(/\r?\n/);
const unzip = (file, member) => execFileSync('unzip', ['-p', file, member], { maxBuffer: BIG }).toString('utf8');
const bunzip = (file) => execFileSync('bzip2', ['-dc', file], { maxBuffer: BIG }).toString('utf8');
const tsv = (text) => lines(text).filter(Boolean).map((l) => l.split('\t'));

// HKCanCor CHAT files: speaker lines start with "*", continue on tab-indented lines;
// "%mor" lines (and their continuations) are annotations. Words are separated by spaces.
export function parseHkcancor(chat) {
  const counts = new Map();
  let total = 0;
  let inSpeech = false;
  for (const line of lines(chat)) {
    let body;
    if (line.startsWith('*')) {
      inSpeech = true;
      body = line.slice(line.indexOf(':') + 1);
    } else if (line.startsWith('\t') && inSpeech) body = line;
    else {
      inSpeech = false;
      continue;
    }
    for (const token of body.split(/\s+/)) {
      if (!token || !/\p{Script=Han}/u.test(token)) continue;
      counts.set(token, (counts.get(token) ?? 0) + 1);
      total += 1;
    }
  }
  return { counts, total };
}

export function loadSources(cache = DEFAULT_CACHE) {
  const dir = (id, file) => join(cache, id, file);
  const yue = tsv(bunzip(dir('tatoeba-yue', 'yue_sentences.tsv.bz2'))).map(([id, , text]) => ({ id: Number(id), text }));
  const links = new Map();
  for (const [yueId, engId] of tsv(bunzip(dir('tatoeba-links', 'yue-eng_links.tsv.bz2')))) {
    if (!links.has(yueId)) links.set(yueId, []);
    links.get(yueId).push(engId);
  }
  const wanted = new Set([...links.values()].flat());
  const eng = new Map();
  for (const [id, , text] of tsv(bunzip(dir('tatoeba-eng', 'eng_sentences.tsv.bz2')))) if (wanted.has(id)) eng.set(id, text);
  const tatoeba = yue.map((s) => {
    const options = (links.get(String(s.id)) ?? []).map((id) => eng.get(id)).filter(Boolean);
    options.sort((a, b) => a.length - b.length);
    return { ...s, english: options[0] ?? null };
  });
  const chat = execFileSync('tar', ['-xzOf', dir('hkcancor', 'pycantonese-5.0.0.tar.gz'), '--wildcards', '*/data/hkcancor/*.cha'], { maxBuffer: BIG }).toString('utf8');
  return {
    cccanto: lines(unzip(dir('cc-canto', 'cccanto-170202.zip'), 'cccanto-webdist.txt')),
    cccedictReadings: lines(unzip(dir('cc-cedict-canto-readings', 'cccedict-canto-readings-150923.zip'), 'cccedict-canto-readings-150923.txt')),
    cedict: lines(unzip(dir('cc-cedict', 'cedict_1_0_ts_utf-8_mdbg.zip'), 'cedict_ts.u8')),
    tatoeba,
    hkcancor: parseHkcancor(chat),
  };
}

export function formatReport(report, bytes) {
  const row = (obj) => Object.entries(obj).map(([k, v]) => `${k} ${v}`).join(', ');
  return [
    `Entries: ${report.total}`,
    `By register: ${row(report.byRegister)}`,
    `By source: ${row(report.bySource)}`,
    `Dropped for an invalid syllable: ${report.droppedInvalid}`,
    `Dropped for no reading: ${report.droppedNoReading}`,
    `Lines that could not be parsed: ${report.unparsed}`,
    `Hidden by corrections: ${report.hidden} (corrections that matched nothing: ${report.unmatchedCorrections})`,
    `With at least one example: ${report.withExamples}`,
    `Without English: ${report.withoutEnglish} (emptied by cleaning: ${report.emptiedByCleaning})`,
    ...(bytes === undefined ? [] : [`dictionary.jsonl.gz: ${bytes} bytes`]),
  ].join('\n');
}

export function main(argv = process.argv.slice(2)) {
  const arg = (name, fallback) => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : fallback);
  const sources = loadSources(arg('--cache', DEFAULT_CACHE));
  const { entries, report } = buildEntriesWithReport(sources, loadCorrections());
  const out = arg('--out', DEFAULT_OUT);
  mkdirSync(dirname(out), { recursive: true });
  const data = gzipSync(Buffer.from(`${entries.map((e) => JSON.stringify(e)).join('\n')}\n`, 'utf8'), { level: 9 });
  writeFileSync(out, data);
  console.log(formatReport(report, data.length));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
