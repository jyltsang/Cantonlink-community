# Sprint 5 retrospective (6 November 2026)

An open dictionary dataset for the CantonLink app's free dictionary, after the owner approved CC-Canto, CC-CEDICT and Tatoeba on 5 November 2026.

## Executive summary

### Key metrics

| Metric | Before | After |
|---|---|---|
| Unit tests (`npm test`) | 90 | 124 |
| Dictionary entries (not in the library) | none | about 131,000, all external-unreviewed |
| Entries with a Tatoeba example | none | 1,163 |
| Entries dropped for an invalid syllable | not applicable | 671 |
| AI spend | | none |

### Wins

- Each source licence was read from the real download, not from a table; the Tatoeba exports carry no licence text, so that source is recorded as unverified rather than assumed.
- Examples are only used when their whole Jyutping is certain; the rest are omitted, so nothing is guessed.
- Corrections apply last, and the override and hide tests were proven to fail against a broken build first.

### Challenges

- Pins go stale: MDBG regenerates its export daily and Tatoeba weekly, so a release tag pushed days after pinning cannot build.
- The first implementation skipped the repository's own documentation loop (retrospective, masters, changelog); a final review found it.
- Only 1,163 of about 131,000 entries have examples, since the corpus is small and unsegmented.

## Issues, root causes and recommendations

| Issue | Root cause | Recommendation |
|---|---|---|
| Release build fails on a stale pin | Checksums of daily and weekly exports | `fetch.mjs --update-pins`, then tag at once |
| Re-run of the release job failed | `gh release create` is not idempotent | Upload with `--clobber` when the release exists |
| Dataset downloaded alone had no credits | Only the data file was attached | Attach `LICENSE` and `SOURCES.md` too |
| Tatoeba licence stated as fact | Written from the spec, not from tatoeba.org | Wording softened until confirmed |

## Action items

1. Confirm the Tatoeba licence from tatoeba.org and record it in `data/dictionary/SOURCES.md`.
2. Tag `dictionary-v1` straight after re-pinning (owner).
3. The developer platform items, in order (Next run).

## Lessons

- Pins of daily or weekly regenerated sources go stale; re-pin, merge and tag the release in one sitting.
