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
| The learning path teaches every pattern and topic exactly once, in order of level | `tools/build.mjs` |
| Spaced review: items climb the five boxes (1, 3, 7, 14 days) and older saves are migrated | `npm test`, `npm run test:e2e` |
| The AI tutor's checks catch bad Jyutping, misaligned characters, written Chinese, wrong library readings and invented grammar references; replies are retried, badged, and unverified ones cannot be saved; no request goes to any host but the chosen provider | `npm test`, `npm run test:e2e` against a scripted provider |
| The slim site data rebuilds the published data file exactly, and the data file matches `dist/schema.json` | `npm test`, `npm test --prefix mcp` |
| The MCP package works on its own: packed, unpacked in an empty folder, and both commands started through npm's symlinks | `npm test --prefix mcp` |

## Verified by hand (October 2026)

- All 180 example sentences and 30 practice pairs were proofread for natural spoken Hong Kong Cantonese, Jyutping tones and English meaning.
- Each fill-the-gap question was checked to make sure its wrong options are wrong *for the English given*.
- Screenshots on a phone (390 px) and on desktop, in light and dark mode, for the home, grammar, pattern, vocabulary, look-up and exercise pages.
- No emoji in the site, README or generated library pages.

## Still needs people

These cannot be automated, and they are the reason the status is "release candidate":

1. **Native-speaker review of all 74 entries:** 60 patterns, 13 word lists and the spoken-or-written set. Two reviewers each, following the [review guide](REVIEW_GUIDE.md). Progress is on the [review status page](../library/review-status.md).
2. **Screen-reader pass** with VoiceOver (iOS or macOS) and NVDA (Windows) on the learning site.
3. **Testing on real devices,** especially older Android phones and iOS Safari.
4. **The AI tutor with real keys.** CI uses a scripted provider. One conversation each with Claude, OpenAI, Gemini and a local Ollama model should confirm that each provider accepts calls from the browser and returns replies in the expected format.
5. **Publishing `cantonlink-mcp` to npm** (`cd mcp && npm publish`), then removing the "Not yet on npm" note from the [MCP guide](MCP_GUIDE.md) and README.
6. **A decision on the Bopomofo scheme.** This project's scheme distinguishes long *aa* and short *a* and uses superscript tone numbers. The CantoLink app uses a different variant, and the two should be aligned.

## Before tagging 1.0.0

- [ ] All entries reviewed, or the draft label kept on those that are not
- [ ] Screen-reader and device findings fixed
- [ ] Changelog updated and a GitHub release created from `main`
