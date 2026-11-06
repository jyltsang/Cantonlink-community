# Dictionary dataset build

`node tools/dictionary/fetch.mjs` downloads the pinned sources, then
`node tools/dictionary/build.mjs` writes `data/dictionary/dist/dictionary.jsonl.gz`
(ignored by git; attached to a release by `.github/workflows/dictionary-release.yml`
when a tag named `dictionary-v*` is pushed) and prints a build report.

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
