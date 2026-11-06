# Dictionary sources

The open data behind the dictionary, pinned by `sources.json`. Run
`node tools/dictionary/fetch.mjs` to download every file, check its SHA-256 and
read its licence text. The command exits non-zero if a checksum is wrong or a
licence differs from the one expected. `--strict` also fails for licences that
cannot be read from a download (marked unverified below) and for pending sources.

## Cache layout

Downloads go to `data/dictionary/.cache/` (ignored by git), one folder per source id:

```
data/dictionary/.cache/<id>/<file>        the download, exactly as published
data/dictionary/.cache/<id>/LICENCE.txt   the licence text read from that download
```

| id | file | holds |
|---|---|---|
| `cc-canto` | `cccanto-170202.zip` | `cccanto-webdist.txt` |
| `cc-cedict-canto-readings` | `cccedict-canto-readings-150923.zip` | `cccedict-canto-readings-150923.txt` |
| `cc-cedict` | `cedict_1_0_ts_utf-8_mdbg.zip` | `cedict_ts.u8` |
| `tatoeba-yue` | `yue_sentences.tsv.bz2` | `id`, `lang`, `text` (tab separated) |
| `tatoeba-eng` | `eng_sentences.tsv.bz2` | `id`, `lang`, `text` (tab separated) |
| `tatoeba-links` | `yue-eng_links.tsv.bz2` | `yue id`, `eng id` (tab separated) |
| `hkcancor` | `pycantonese-5.0.0.tar.gz` | CHAT files in `pycantonese-5.0.0/src/pycantonese/data/hkcancor/` |

## Licence check, 2026-11-06

Each licence was read from the real download (not from this document).

| Source | Expected | Result | Evidence |
|---|---|---|---|
| CC-Canto, version 2017-02-02 | CC BY-SA 3.0 | Confirmed | Header: "Copyright (c) 2015-17 Pleco Inc. Distributed under a Creative Commons Attribution-Share Alike 3.0 license (http://creativecommons.org/licenses/by-sa/3.0/)" |
| CC-CEDICT Cantonese readings, version 2015-09-23 | CC BY-SA 3.0 | Confirmed | Header: "Copyright (c) 2015 Pleco Software Incorporated. Distributed under a Creative Commons Attribution-Share Alike 3.0 license (http://creativecommons.org/licenses/by-sa/3.0/)" |
| CC-CEDICT, MDBG export of 2026-11-05 | CC BY-SA 4.0 | Confirmed | Header: "License: Creative Commons Attribution-ShareAlike 4.0 International License, https://creativecommons.org/licenses/by-sa/4.0/"; refers to CEDICT, copyright 1997, 1998 Paul Andrew Denisowski |
| HKCanCor | CC BY 4.0 | Confirmed | `LICENSE.txt` inside the PyCantonese 5.0.0 source package begins "Creative Commons Attribution 4.0 International Public License"; its README says it is a copy of the licence from the HKCanCor source (github.com/fcbond/hkcancor, `data/LICENSE`), which also begins with that title |
| Tatoeba Cantonese, English, links | CC BY 2.0 FR | Not confirmed from a download | See below |

### Tatoeba: not confirmed

The Tatoeba exports hold only sentence text, language codes and id pairs; they
carry no licence text, and `tatoeba.org` (where the terms of use state CC BY
2.0 FR) cannot be reached from the environment where this check ran
(downloads.tatoeba.org can). Until the licence is read from tatoeba.org, the
sources are marked `unverified` in `sources.json`. The owner or a later run
with access should read https://tatoeba.org/en/terms_of_use and downloads
page, and record what they say here. Note that individual Tatoeba sentences can
be released under CC0 instead (`*_sentences_CC0.tsv.bz2`); CC BY is the default
for the rest.

### HKCanCor source

The original GitHub archive (codeload.github.com) is not reachable here, so the
corpus is taken from the PyCantonese 5.0.0 source package on PyPI (a CHAT
rendering of the same corpus, with changes to format only). Its checksum is
the one PyPI publishes. HKCanCor is used only for word frequency.

## Snapshots and updates

The checksums pin a snapshot. Two publishers replace their files in place:

- MDBG regenerates the CC-CEDICT export daily.
- Tatoeba regenerates its exports weekly and keeps only the latest.

When the checksum no longer matches, `fetch.mjs` fails and prints the new
checksum. Update `sources.json` (url, version and sha256) in a pull request, and
read the licence again, since the check runs on every fetch.

Links use the small per-language file `yue-eng_links.tsv.bz2` (about 45 kB)
rather than the full `links.tar.bz2` (about 150 MB); it holds the Cantonese to
English pairs, which is all the dictionary needs.

## Excluded datasets

See the design spec for the Hugging Face datasets checked on 2026-11-05 and excluded.
