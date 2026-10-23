# Quality report

This report records the quality checks made on the content of the Community Edition, what they found and what was changed. It complements the automatic checks in [`tools/build.mjs`](../tools/build.mjs) and the [release checklist](RELEASE_CHECKLIST.md). None of this replaces review by native speakers: every entry stays marked "draft" until two native speakers have checked it.

## 1. Independent pronunciation check

Every reading in `content/` (759 entries: words, classifiers, example sentences, corrections, spoken-or-written pairs, unit titles and practice distractors) is compared with an independent Cantonese pronunciation dictionary, [to-jyutping](https://github.com/CanCLID/to-jyutping) by the Cantonese Computational Linguistics Infrastructure Development Workgroup (CanCLID). Sentences are read in context, so the dictionary can choose between readings of the same character. The check runs in CI as part of `npm run check` ([`tools/check-pronunciation.mjs`](../tools/check-pronunciation.mjs)).

**Result:** 48 differences in 31 words. None of our readings was outside the dictionary's list of accepted readings for the character.

| Outcome | Count | Detail |
|---|---|---|
| Error, fixed | 1 | 鴛鴦 (yuenyeung, coffee with milk tea) was jin1 joeng1, a casual variant; it is now jyun1 joeng1, the standard reading. |
| Deliberate, documented | 30 | Colloquial readings that the dictionary ranks second, e.g. 坐 co5 (not literary zo6), 近 kan5, 碟 dip2 as a classifier, 女 neoi2 'daughter', changed tones such as 慢慢 maan6 maan2 and 樓 lau2 'flat'. Each has a reason in [`content/pronunciation-notes.json`](../content/pronunciation-notes.json). |

Any new reading that differs from the dictionary now fails CI until it is either fixed or explained, and a note that no longer applies also fails, so the list stays accurate.
