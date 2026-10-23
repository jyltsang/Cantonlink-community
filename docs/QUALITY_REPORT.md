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

## 2. Proofreading pass

All 60 grammar patterns (explanations, 180 examples, mistake notes), 390 words, 30 spoken-or-written pairs and the 12 unit goals were re-read for natural Hong Kong speech, tones, English meaning, register and British spelling. The content was in good shape; the changes were small.

| Entry | Before | After | Reason |
|---|---|---|---|
| gwo3-experience, example 2 | 鴛鴦 jin1 joeng1 | jyun1 joeng1 | Standard reading (see section 1) |
| Vocabulary: 婆婆 | grandmother (maternal) | grandmother (mother's side) | Consistent with 爺爺, 嫲嫲 and 公公 |
| Vocabulary: 地鐵 | underground train | underground railway; the MTR (older everyday name) | In Hong Kong 地鐵 means the MTR |
| Spoken or written, pair 29 | 東西 → 嘢 | 東西 → 啲嘢 | 啲 is part of the change |

## 3. Exercise audit

### Fill the gap

Every question was checked for a wrong option that would also make a correct, natural sentence for the English given. Nine questions were changed:

| Question | Wrong option removed | Replaced by | Why it was a problem |
|---|---|---|---|
| zo2-completed 1: 我食咗飯喇 | 過 | 住 | 我食過飯喇 is a common way to say "I've already eaten" |
| mei6-yet 1–2: 你食咗飯未呀, 佢到咗未呀 | 冇 | 啦 | "…咗…冇？" questions are heard in casual speech |
| jyun4-finish 1–2: 我做完功課喇, 你食完飯未呀 | 過 | 住 | 做過功課 and 食過飯 overlap with "finished" |
| hou2-ci5-seem 1–3 | 應該 | 唔使 | 應該 "probably" is too close to 好似 "seems" for a fair question |
| ge3-possessive 2–3, jyut6-lai4-jyut6 2, sin1-zoi3-first-then 2 | an option already in the sentence | a new word | An option repeated from the sentence is easy to rule out, so the question tests less |

Two new build rules keep these problems from coming back: a wrong option may not already appear in the sentence, and it may not be a word that can stand in for the answer (乜嘢 / 咩, 點 / 點樣, 定係 / 定, 而家 / 依家, 畀 / 俾).

### Build the sentence

Every item was checked for another natural word order. 14 items have one, and these are now accepted as correct, with the library's version shown alongside:

- choices joined by 定係 or 同 in either order (茶定係咖啡 / 咖啡定係茶)
- 點解, 如果, 雖然 and 因為 before or after the subject (點解你學… / 你點解學…)
- a time word before the subject (聽日我會…), and 快啲啦 before 已經十點喇

The build checks that each accepted order uses exactly the sentence's words and does not repeat another order. Alternatives are shown in the printable worksheets and in the MCP practice tool's answers. Items whose other orders would change the meaning (佢係我朋友 / 我係佢朋友) accept only one order.
