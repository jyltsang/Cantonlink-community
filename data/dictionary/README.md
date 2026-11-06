# Dictionary dataset build

`node tools/dictionary/fetch.mjs` downloads the pinned sources, then
`node tools/dictionary/build.mjs` writes `data/dictionary/dist/dictionary.jsonl.gz`
(ignored by git; attached to a release by `.github/workflows/dictionary-release.yml`
when a tag named `dictionary-v*` is pushed) and prints a build report.

## Releasing

The first release tag is `dictionary-v1`; the CantonLink app pins a tag. Pins go stale: MDBG
regenerates the CC-CEDICT export daily and Tatoeba replaces its exports weekly, and `fetch.mjs`
fails on a checksum mismatch, so a tag pushed some days after the pins were taken cannot build.
To release:

1. `node tools/dictionary/fetch.mjs --update-pins` (downloads afresh and rewrites the `sha256` values in `sources.json`), then set each changed `version` by hand.
2. `node tools/dictionary/fetch.mjs` (checks the checksums and re-reads every licence; stop if one differs), then `node tools/dictionary/build.mjs` and read the report.
3. Merge that change to `main`, then push the tag at once: `git tag dictionary-v1 && git push origin dictionary-v1`. Do not leave days between merging and tagging.

The workflow attaches `dictionary.jsonl.gz`, `LICENSE` and `SOURCES.md` to the release; the
licence and credits must travel with the dataset.

Every entry has the status `external-unreviewed`.

## corrections.json

CantonLink's own edits, applied last, so a source update never removes them. A list of rules:

```json
{
  "match": { "characters": "唔該", "jyutping": "m4 goi1" },
  "set": { "jyutping": "...", "english": ["..."], "register": "colloquial | general | written" },
  "hide": true
}
```

- `match.characters` (traditional) and `match.jyutping` (the reading as the source gives it, before any correction) pick the entry. Without `jyutping`, every reading of the characters matches.
- `set` is optional. `jyutping` must be valid; `english` replaces the meanings; `register` sets the register.
- `hide: true` removes the entry from the dataset.
- A rule that matches nothing is counted in the build report.

## written-markers.json

Entries are marked `written` when their characters are in `characters`, or when their first
English meaning contains one of `english_patterns` (for example "(literary)"). CC-Canto
entries are only marked by `characters`.

## Cleaning the English

The sources write cross-references into their glosses. A learner sees English only, so every
source's glosses (CC-Canto and CC-CEDICT) are cleaned before corrections:

- A meaning is split on `;` into segments.
- A segment with a reference (Chinese characters or a pinyin bracket) and a pure-reference lead-in is dropped whole, whatever comes before the lead-in, because that text is a modifier ("old", "erhua", "(Cantonese)", "to"), not a meaning. The lead-ins are one table in `build.mjs` taken from the real data: `variant of`, `form of`, `contraction of`, `see`, `see also`, `to see`, `cf.`, `abbr. for/to/of`, `abbreviation for`, `short for`, `also written`, `also pr.`, `also read`, `also called`, `also known as`, `CL:`, `pr.`, `used in`, `euphemism for`, `another name for`, `alternative name/term for`, `internet slang for`.
- With `equivalent to`, `Mandarin/dialectal/Taiwan/PRC equivalent`, `same as` or `similar to`, the text before is kept only if it has at least two Latin words ("Cantonese particle equivalent to 了[le5]" becomes "Cantonese particle"). With a measure-word marker `M:` the text before is a real meaning and is kept ("people M: 個[ge4]" becomes "people").
- A reference inside a longer name is removed and the rest kept ("a county in Zhoushan City 舟山市[Zhou1 shan1 Shi4], Zhejiang" becomes "a county in Zhoushan City, Zhejiang").
- A parenthetical note that holds a cross-reference is removed ("(Mandarin equivalent: 什麼|什么[shen2 me5])").
- A segment with Chinese characters but no bracket has the characters stripped, and is kept only if a Latin word of 2 or more letters remains outside notes; one that starts with a lead-in word before the characters ("Mandarin equivalent: 他tā") is dropped.
- Empty brackets, stray `|` and extra spaces are removed; a plain bracketed note becomes a parenthetical one (`[colloquial]` to `(colloquial)`); real notes such as `it (Cantonese)` stay.
- After cleaning, a segment that is only a bare modifier (old, archaic, erhua, Japanese, Taiwan, Tw, dialect, literary, euphemistic, abbreviation, contracted, to, Cantonese, with or without brackets) is dropped.
- An entry whose English becomes empty is kept with `english: []` and counted in the build report ("emptied by cleaning").
- A correction's `set.english` is used as written and never cleaned. The build fails, naming the entry id, if any entry's English has a Chinese character, kana, `[`, `]` or `|`, so a bad correction is caught.

## Frequency

`frequency` is a number (never null), the sum of two per-million rates, rounded to 2 places:

```
frequency = hkcancor_count / hkcancor_tokens * 1e6
          + tatoeba_count  / tatoeba_characters * 1e6
```

- `hkcancor_count`: times the exact word occurs as a token in HKCanCor; `hkcancor_tokens` is all tokens containing Chinese characters.
- `tatoeba_count`: times the characters occur as a substring of a Tatoeba Cantonese sentence (substrings up to 8 characters); `tatoeba_characters` is the total length of those sentences.
- It is by characters, not reading, so homographs share a value. Short words are overstated because they sit inside longer ones. It is only used to order entries within one register.

Ranking is register (colloquial, general, written), then frequency, highest first.

## Examples

Up to two Tatoeba Cantonese sentences per entry, shortest first, each with an English link and
its Tatoeba id (credit: `https://tatoeba.org/en/sentences/show/<id>`). The Jyutping of a
sentence is only given when every part of it is certain (see the header of `build.mjs`);
otherwise the example is omitted rather than guessed.
