# Quality report

This report records the quality checks made on the content of the Community Edition, what they found and what was changed. It complements the automatic checks in [`tools/build.mjs`](../tools/build.mjs) and the verification summary in [What has been developed](DEVELOPED.md#how-it-is-verified). None of this replaces review by native speakers: every entry stays marked "draft" until two native speakers have checked it.

## 1. Independent pronunciation check

Every reading in `content/` (853 entries: words, classifiers, example sentences, corrections, spoken-or-written pairs, unit titles, dialogue lines and practice distractors) is compared with an independent Cantonese pronunciation dictionary, [to-jyutping](https://github.com/CanCLID/to-jyutping) by the Cantonese Computational Linguistics Infrastructure Development Workgroup (CanCLID). Sentences are read in context, so the dictionary can choose between readings of the same character. The check runs in CI as part of `npm run check` ([`tools/check-pronunciation.mjs`](../tools/check-pronunciation.mjs)).

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

## 4. Model dialogues

The 12 new dialogues (94 lines) were written for natural Hong Kong speech at each unit's level and checked like every other sentence: Jyutping validity, one syllable per character, no written Chinese, and the independent pronunciation check. Four further colloquial readings were documented (喂 wai2 on the phone, 卡 kaat1 'card', 左右 zo2 jau6 'about', and 呀 aa3 in replies). One spelling was changed to the more standard form: 海傍 to 海旁 hoi2 pong4. The build also checks that each dialogue uses at least three of its unit's grammar patterns.

## 5. Live AI tutor test

The AI tutor was tested against a real provider, **Google Gemini**, by driving the deployed site in a browser ([`tests/live-ai.mjs`](../tests/live-ai.mjs), run from the **Live AI provider test** workflow). Each run covers a connection test, a three-turn conversation, a Sifu correction, a translation, a grammar explanation and a unit role-play. Claude and OpenAI were not tested live; they are covered by recorded-response tests.

| Run | Model | Result | What it showed, and the fix |
|---|---|---|---|
| 1 | gemini-2.5-flash | Failed | The default model had been retired (404). New default; "Test connection" now warns about retired models. |
| 2 | gemini-3.8-flash | Failed | Model overloaded (503) and requests hung for minutes. Two retries with backoff; a 90-second limit per request; **Try again** in the chat. |
| 3 | gemini-3.8-flash | Failed | Free tier allows 20 requests a day; the client retried a quota that resets in hours. A used-up quota is now reported at once. |
| 4 | gemini-flash-lite-latest | 3 of 3 completed replies passed; then rate-limited | Fast (4–5 s). Made the default; the test now pauses between steps. |
| 5 | (key rejected) | Not run | The API key had been replaced. The test now stops at once when the key is rejected. |
| 6 | gemini-flash-lite-latest | **Passed**, 7 of 7 Verified or Corrected, 20 requests | See below. |

**Reading the replies of run 6 by hand** found three things the pass/fail did not:

- The translation 我开会就迟喇 was in **Simplified characters**. Check 4 now fails Simplified characters and gives the model the Traditional forms for its retry (开 → 開).
- An example sentence, 你未去過長洲未呀, repeats 未 and is ungrammatical (it should be 你去過長洲未呀). It passed every check: the checks test spelling, romanisation, written-Chinese forms and library readings, not grammar. This is why every reply is labelled AI-generated and has a **Report** link.
- The role-play step had not really run (the test clicked the navigation's Tutor link); the test is fixed.

A paid run costs about 1–3 US cents with the default model; the test stops after 40 requests whatever happens.

## 6. Readings for characters inside English text

With characters turned off (the default), learners see no Chinese characters anywhere, so every character that appears inside English text (grammar explanations, mistake notes, word notes, pattern names and topic names) needs a reading. The build works them out and checks them:

- **Pattern names** use each pattern's own Jyutping (Verb + 咗 → Verb + zo2); the build checks that the Jyutping has one valid syllable for each character.
- **Topic names** have a hand-written reading in each vocabulary file (`titleJyutping`), checked like every other entry.
- **Explanations and notes** use the library's own words, longest first. Where a single character has more than one reading in the library, the build stops until a checked reading is added to `content/prose-readings.json`. Ten were needed:

| Characters | Reading | Where | Why |
|---|---|---|---|
| 呢 | ni1 | everywhere | the demonstrative "this", not the particle ne1 |
| 會 | wui5 | everywhere | the modal "will; can" |
| 間 | gaan1 | everywhere | the classifier |
| 件 | gin6 | everywhere | the classifier |
| 人 | jan4 | everywhere | 畀人 "by someone" |
| 上 | soeng5 | everywhere | the directional verb "to go up" |
| 行 | haang4 | everywhere | "to walk" |
| 行得好慢 | haang4 dak1 hou2 maan6 | dak1-degree | 慢 maan6, not the changed tone maan2 |
| 賣晒 | maai6 saai3 | saai3-all | 賣 maai6 "to sell" |
| 到 | dou2 | dou2-result | the resultative complement |

- **Written forms** that the notes warn against (他, 是, 不, 沒, 吃, 了, 這, 在, 哪, 很, 甚麼, 們, 吧, 說, 給, 比, 被) are not in the spoken-Cantonese library, so their readings come from the independent dictionary (to-jyutping), e.g. 他 taa1, 是 si6.
- One explanation was reworded: dou2-result said "a different word from 到 (dou3)", which cannot be read correctly without characters when the same character is read dou2 elsewhere in the note. It now says "a different word from dou3 'to arrive', which is written with the same character".

A browser test visits every page (every grammar pattern, word topic and unit, Look up, each exercise, review, the tutor and AI settings) in Jyutping and in Yale, and fails if any Chinese character appears.

## 7. Automated accessibility checks (30 October 2026)

Every page (18 routes) is checked with axe-core for WCAG 2.0, 2.1 and 2.2 A and AA rules, in light mode with characters off and in dark mode with characters on (`tests/e2e.mjs`). Serious and critical violations fail CI.

| Finding | Impact | Fix |
|---|---|---|
| Flashcard button labelled "Card. Select to turn over." while showing the word: its accessible name did not contain its visible text (`label-content-name-mismatch`), so a speech-input user saying the word could not select it | Serious | The fixed label is removed; the card is named by its own text and uses `aria-pressed` to say whether it is turned over |

No other serious or critical violations were found. Automated checks catch only part of WCAG; the screen-reader and device testing in the release criteria is still needed.

## 8. More examples for each A1 pattern (30 October 2026)

Each of the 24 A1 patterns gained two original example sentences (48 in all), so every A1 pattern now has five, in new everyday contexts: work, health, transport, shopping, food, weather and home. All are drafts until two native speakers review them.

- **Automatic checks:** valid Jyutping, one syllable per character, no written-Chinese forms, distractors rules, accepted orders. The build caught one distractor (咗) that already appeared in its own sentence; it was replaced.
- **Pronunciation cross-check:** two readings differed from the reference dictionary.
  - 會 in 開緊會 is wui2 ("a meeting", the changed tone of 開會); documented in `content/pronunciation-notes.json`.
  - 掂 "to touch" (dim3) was replaced with a different sentence (唔好咁大聲, "Don't be so loud") rather than relying on a disputed reading.
- **Proofreading:** every sentence read for tones and for whether a Hong Kong speaker would say it. Accepted word orders were added where another order is natural: fronted time words (聽日我要返工), swapped partners with 同, and swapped choices with 定係.

## 9. First batch of B1 gaps (30 October 2026)

Three B1 particles were added as new patterns, each with three examples, fill-the-gap and draft status: 添 (tim1, "too; as well; even", unit 10), 啩 (gwaa3, "I suppose; probably", unit 11) and 嘛 (maa3, "it's obvious; that's why", unit 12, beside 囉 and 喎). 嘛 has a mistake note, because it sounds the same as the question particle 嗎.

Sentence-final 先 was already taught in `sin1-zoi3-first-then` (等我諗吓先), so it gained a second example (你行先, "You go first") rather than a pattern of its own: the path teaches each point once. A planned mistake note calling 我先食 wrong was dropped before release, because the pattern's own example 我哋先食飯 shows 先 before the verb is correct.

- **Automatic checks:** content valid; every pattern taught exactly once; unit dialogues still use at least three of their unit's patterns.
- **Pronunciation cross-check:** all 912 readings agree with the reference dictionary, including 嘛 maa3 and 啩 gwaa3; no new notes were needed.
- **Characters off:** the new explanations get readings from the build; the MCP guard and the site-wide browser test cover the new patterns.
