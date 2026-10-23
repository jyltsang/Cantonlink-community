// Jyutping is the single source of truth. Yale and Bopomofo are always
// derived from it here, so the three systems can never disagree.

const INITIALS = ['ng', 'gw', 'kw', 'b', 'p', 'm', 'f', 'd', 't', 'n', 'l', 'g', 'k', 'h', 'w', 'z', 'c', 's', 'j'];

const FINALS = [
  'aa', 'aai', 'aau', 'aam', 'aan', 'aang', 'aap', 'aat', 'aak',
  'ai', 'au', 'am', 'an', 'ang', 'ap', 'at', 'ak',
  'e', 'ei', 'eu', 'em', 'en', 'eng', 'ep', 'et', 'ek',
  'i', 'iu', 'im', 'in', 'ing', 'ip', 'it', 'ik',
  'o', 'oi', 'ou', 'on', 'ong', 'ot', 'ok',
  'oe', 'oeng', 'oek', 'oet', 'eoi', 'eon', 'eot',
  'u', 'ui', 'un', 'ung', 'ut', 'uk',
  'yu', 'yun', 'yut',
];

const SYLLABIC_NASALS = ['m', 'ng'];

const SYLLABLE_RE = /^([a-z]+?)([1-6])$/;

export function parseSyllable(syllable) {
  const match = SYLLABLE_RE.exec(syllable);
  if (!match) return null;
  const [, base, tone] = match;
  if (SYLLABIC_NASALS.includes(base)) return { initial: '', final: base, tone: Number(tone), nasal: true };
  for (const initial of ['', ...INITIALS]) {
    if (!base.startsWith(initial)) continue;
    const final = base.slice(initial.length);
    if (FINALS.includes(final)) return { initial, final, tone: Number(tone), nasal: false };
  }
  return null;
}

export function isValidSyllable(syllable) {
  return parseSyllable(syllable) !== null;
}

// --- Yale -----------------------------------------------------------------

const YALE_INITIALS = { z: 'j', c: 'ch', j: 'y' };
const YALE_FINALS = { aa: 'a', eu: 'eeu', oe: 'eu', oeng: 'eung', oek: 'euk', oet: 'eut', eoi: 'eui', eon: 'eun', eot: 'eut' };
const TONE_MARKS = { 1: '̄', 2: '́', 4: '̀', 5: '́' };
const LOW_TONES = new Set([4, 5, 6]);
const VOWELS = 'aeiou';

export function toYale(syllable) {
  const parsed = parseSyllable(syllable);
  if (!parsed) throw new Error(`Invalid Jyutping syllable: "${syllable}"`);
  const { initial, final, tone, nasal } = parsed;
  const mark = TONE_MARKS[tone] ?? '';
  const h = LOW_TONES.has(tone) ? 'h' : '';

  if (nasal) return (final[0] + mark + final.slice(1) + h).normalize('NFC');

  let yInitial = YALE_INITIALS[initial] ?? initial;
  let yFinal = YALE_FINALS[final] ?? final;
  // Jyutping "jyu" is Yale "yu": the y of the initial merges with the final.
  if (yInitial === 'y' && yFinal.startsWith('yu')) yInitial = '';

  const markAt = [...yFinal].findIndex((ch) => VOWELS.includes(ch));
  // Low-tone h follows the whole vowel cluster, before any consonant coda.
  const codaAt = yFinal.search(/(m|n|ng|p|t|k)$/);
  const nucleusEnd = codaAt === -1 ? yFinal.length : codaAt;
  const marked = yFinal.slice(0, markAt + 1) + mark + yFinal.slice(markAt + 1, nucleusEnd) + h + yFinal.slice(nucleusEnd);
  return (yInitial + marked).normalize('NFC');
}

// --- Bopomofo -------------------------------------------------------------
// Cantonese has six tones and contrasts long aa with short a, which Mandarin
// Bopomofo cannot express. This scheme uses Bopomofo Extended letters for
// Cantonese sounds, ㄜ for short a, and superscript tone numbers.

const BOPOMOFO_INITIALS = {
  b: 'ㄅ', p: 'ㄆ', m: 'ㄇ', f: 'ㄈ', d: 'ㄉ', t: 'ㄊ', n: 'ㄋ', l: 'ㄌ',
  g: 'ㄍ', k: 'ㄎ', ng: 'ㆭ', h: 'ㄏ', gw: 'ㄍㄨ', kw: 'ㄎㄨ', w: 'ㄨ',
  z: 'ㄗ', c: 'ㄘ', s: 'ㄙ', j: 'ㄧ',
};

const BOPOMOFO_NUCLEI = { aa: 'ㄚ', a: 'ㄜ', e: 'ㄝ', i: 'ㄧ', o: 'ㄛ', oe: 'ㆦ', eo: 'ㆤ', u: 'ㄨ', yu: 'ㄩ' };
const BOPOMOFO_CODAS = { i: 'ㄧ', u: 'ㄨ', m: 'ㆬ', n: 'ㄣ', ng: 'ㄥ', p: 'ㆴ', t: 'ㆵ', k: 'ㆶ' };
const SUPERSCRIPT = { 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶' };

function splitFinal(final) {
  for (const nucleus of ['aa', 'oe', 'eo', 'yu', 'a', 'e', 'i', 'o', 'u']) {
    if (final.startsWith(nucleus)) return [nucleus, final.slice(nucleus.length)];
  }
  throw new Error(`Unknown final: "${final}"`);
}

export function toBopomofo(syllable) {
  const parsed = parseSyllable(syllable);
  if (!parsed) throw new Error(`Invalid Jyutping syllable: "${syllable}"`);
  const { initial, final, tone, nasal } = parsed;
  if (nasal) return BOPOMOFO_CODAS[final] + SUPERSCRIPT[tone];

  const [nucleus, coda] = splitFinal(final);
  // "ji…", "jyu…" and "wu": the glide initial is already carried by the vowel.
  const glideAbsorbed = (initial === 'j' && (nucleus === 'i' || nucleus === 'yu')) || (initial === 'w' && final === 'u');
  const head = glideAbsorbed ? '' : (BOPOMOFO_INITIALS[initial] ?? '');
  return head + BOPOMOFO_NUCLEI[nucleus] + (BOPOMOFO_CODAS[coda] ?? '') + SUPERSCRIPT[tone];
}

// --- Phrases --------------------------------------------------------------

const syllablesOf = (jyutping) => jyutping.trim().split(/\s+/).filter(Boolean);

// Code-mixed phrases such as 寫 code ("se2 code") keep their English words
// as they are. Every Jyutping syllable ends in a tone number; English does not.
const keepEnglish = (convert) => (token) => (/\d$/.test(token) ? convert(token) : token);

export function phraseToYale(jyutping) {
  return syllablesOf(jyutping).map(keepEnglish(toYale)).join(' ');
}

export function phraseToBopomofo(jyutping) {
  return syllablesOf(jyutping).map(keepEnglish(toBopomofo)).join(' ');
}

export function romanise(jyutping) {
  return { jyutping, yale: phraseToYale(jyutping), bopomofo: phraseToBopomofo(jyutping) };
}
