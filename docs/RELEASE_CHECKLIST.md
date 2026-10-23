# Release checklist: 1.0.0-rc.1

This page records what has been verified for the first release candidate, and what still needs people. Use it as the starting point for checking the project.

## Verified automatically (on every change, in CI)

| Check | How |
|---|---|
| Every Jyutping syllable is valid | `tools/build.mjs`, against the full set of Jyutping initials and finals |
| Each word has one syllable per character | `tools/build.mjs` |
| No tell-tale written Chinese in spoken sentences or word lists | `tools/build.mjs` (他, 她, 們, 這, 哪, 沒, 吃, 很, 喝, and words such as 是, 的, 不, 了, 在) |
| No word is listed in two topics | `tools/build.mjs` |
| Every exercise has a valid answer and three distinct wrong options, all with known Jyutping | `tools/build.mjs` |
| Every related-pattern link resolves | `tools/build.mjs` |
| "Reviewed" needs two named reviewers | `tools/build.mjs` |
| Yale matches the pingyambiu reference for all ~4,000 syllables; Bopomofo is unambiguous | `npm test` |
| Generated pages and data match the content; content JSON is formatted | `npm run check` |
| Every page renders in Chromium without errors, unnamed buttons, programming values or sideways scrolling | `npm run test:e2e` |
| Each learning journey works end to end: grammar, practice for one pattern, build the sentence, look-up and conversion, display settings, review of missed items, all drills, export and import, offline use | `npm run test:e2e` |

## Verified by hand (October 2026)

- All 180 example sentences and 30 practice pairs were proofread for natural spoken Hong Kong Cantonese, Jyutping tones and English meaning.
- Each fill-the-gap question was checked to make sure its wrong options are wrong *for the English given*.
- Screenshots on a phone (390 px) and on desktop, in light and dark mode, for the home, grammar, pattern, vocabulary, look-up and exercise pages.
- No emoji in the site, README or generated library pages.

## Still needs people

These cannot be automated, and they are the reason the status is "release candidate":

1. **Native-speaker review of all 73 entries:** 60 patterns, 12 word lists and the spoken-or-written set. Two reviewers each, following the [review guide](REVIEW_GUIDE.md). Progress is on the [review status page](../library/review-status.md).
2. **Screen-reader pass** with VoiceOver (iOS or macOS) and NVDA (Windows) on the learning site.
3. **Testing on real devices,** especially older Android phones and iOS Safari.
4. **A decision on the Bopomofo scheme.** This project's scheme distinguishes long *aa* and short *a* and uses superscript tone numbers. The CantoLink app uses a different variant, and the two should be aligned.

## Before tagging 1.0.0

- [ ] All entries reviewed, or the draft label kept on those that are not
- [ ] Screen-reader and device findings fixed
- [ ] Changelog updated and a GitHub release created from `main`
