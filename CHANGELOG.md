# Changelog

## Unreleased

### Housekeeping and the self-improvement loop
- Planning is consolidated into three master documents: [What has been developed](docs/DEVELOPED.md), the [master plan](docs/MASTER_PLAN.md) and [Next run](docs/NEXT_RUN.md). They replace the product specification and the release checklist, whose out-of-date parts (360 words, a React front end, "no AI") are corrected.
- The first [retrospective](docs/retrospectives/sprint-01.md) covers the whole project so far, from CI history and the changelog.
- A `CLAUDE.md` with standing rules and lessons learned, and a `/next-run` skill that every working session follows: read, agree scope, build, verify, look back, update the masters, learn.
- `npm run ci` runs everything CI runs; a new link test checks every relative link and heading anchor in the documentation, and that the master documents are in place.
- Stale facts fixed in the README, CONTRIBUTING, curriculum and MCP guide; OpenCC data and the build's development tools are now attributed in NOTICE; two unused functions removed.

### On brand: the CantonLink design system
- The learning site now uses the CantonLink design system: cream canvas, white cards, ink pill buttons, the jade, hibiscus, persimmon, laicha and inkblue colour families, Elms Sans and JetBrains Mono, and the signature hard-offset shadow on clickable cards.
- Dark mode is derived from the brand (warm ink canvas, cream text) rather than a separate palette.
- Romanisation first: Jyutping is set in mono with tone numbers as superscripts; the text itself is unchanged, so copying and screen readers still get "nei5 hou2". Characters are now **off by default** (a choice already saved in the browser is kept) and appear beneath the romanisation when turned on.
- **Try first**, the output-first pattern, is the default for unit dialogues: you play the second speaker, see what to say in English, try it, then reveal it. Revealed lines count towards the unit's progress. **Read** shows the whole dialogue as before.
- **No characters anywhere when they are off.** Grammar pattern names (Verb + zo²), explanations, mistake notes, word notes, topic names, classifiers, the tone table and the home page now follow the setting, using readings worked out and checked at build time (see the quality report, section 6). Spoken or written?, which is about characters, is hidden until characters are turned on. With characters off, the AI tutor is asked to write Cantonese words in its explanations in Jyutping. A browser test checks every page.
- New fields in the data file: `patternRomanised` and `explanationParts` on grammar patterns, `noteParts` on mistakes and word notes, and `titleWord` on vocabulary topics.
- A new test checks WCAG AA contrast (4.5:1 for text, 3:1 for controls) for every colour pair the site uses, in both themes.

## 1.0.0-rc.2 · 24 October 2026

### AI tutor tested live, and made robust
- Tested on the deployed site with a real Gemini key; the final run passed with every reply Verified or Corrected (20 requests).
- The live tests found and fixed: a retired default model (now the `gemini-flash-lite-latest` alias), no retry on busy providers (now two retries with backoff), requests that never ended (now a 90-second limit), a used-up quota retried pointlessly (now reported at once with when it resets), and Simplified characters passing the checks (check 4 now catches them, using a list generated from OpenCC data).
- Errors in the chat offer **Try again**; "Test connection" warns about retired models; the live test caps its requests to protect paid keys.
- `cantonlink-mcp@1.0.0-rc.2` published to npm.


### Model dialogues and a quality pass
- Each of the 12 units has a model dialogue (94 lines), shown on the unit page with the English hidden until asked for, practised as build-the-sentence items, and used by the AI tutor for role-play. The build checks that each dialogue uses at least three of its unit's patterns.
- Every reading (853 entries) is cross-checked against an independent dictionary, to-jyutping, in CI; differences are fixed or documented in `content/pronunciation-notes.json`.
- A proofreading pass and an exercise audit: nine fill-the-gap questions fixed, 14 build-the-sentence items now accept another natural word order, and new build rules guard against ambiguous wrong options. See [docs/QUALITY_REPORT.md](docs/QUALITY_REPORT.md).
- Fixed: the Pages deploy did not install dependencies before checking content; a test now checks every workflow.
- The Bopomofo scheme is decided and documented, with complete initial and final tables generated from the converter.

### One-line MCP install and a terminal CLI
- The MCP server is packaged as `cantonlink-mcp`, self-contained (the library and data are bundled at pack time), so apps can start it with `npx -y cantonlink-mcp`.
- A `cantonlink` command in the same package: `word` (search, or a word of the day), `quiz` (an interactive fill-the-gap quiz) and `romanise`.
- Fixed: started through npm's command symlink, the server would not have started at all; the start-up check now resolves symlinks.
- Tests pack the package, unpack it in an empty folder and run both commands through symlinks.

### Data schema and a lighter site
- `dist/schema.json`: a JSON Schema for the data file, generated by the build and checked against the data in CI.
- `dist/site-data.json`: a compact copy for the website, 122 KB instead of 875 KB (30 KB instead of 88 KB compressed). The site rebuilds the full structure with `hydrate()` from `tools/data.mjs`, and a test checks the result matches the published file exactly.

### Tech and work vocabulary
- A new topic of 30 words for office and tech work, with the code-mixed forms Hong Kong people actually use (寫 code, 出 bug, 趕 deadline, 開 OT) next to the Cantonese terms, taught in unit 10 of the learning path.
- Code-mixed entries are supported throughout: the build matches the English words between characters and Jyutping, and romanisation keeps them unchanged.

### Learning path
- `content/path.json`: 12 units from A1 to B1, each pairing a few grammar patterns with vocabulary around an everyday situation. The build checks that every pattern and topic is taught exactly once, in order of level.
- A `#/path` page with progress per unit, a page for each unit (grammar, words, practice), a mixed practice session per unit that starts with what you have not practised, and a Continue card on the home page.
- "Practise with the AI tutor" from any unit sets the level and scenario and asks the tutor to use that unit's patterns.
- A readable [learning path](library/path.md) in the library.

### Spaced repetition
- Review now follows a five-box Leitner schedule: a missed item is due at once, and each correct review waits longer (1, 3, 7, then 14 days) until the item is learnt. A miss starts it again.
- The home page shows how many items are due now and when the next review is; the navigation count shows only items that are due.
- Progress saved by earlier versions is carried over.

### AI tutor (bring your own key)
- AI settings page for Claude, OpenAI, Gemini or any OpenAI-compatible server (Ollama, LM Studio, OpenRouter…), with the key kept in memory unless "remember" is ticked.
- Chat screen with Friend and Sifu modes, level and scenario, library look-ups shown as they happen, and "Check my sentence".
- Every reply passes eight visible checks (structure, Jyutping, alignment, written Chinese, library agreement, grammar references, local romanisation, optional second opinion), with one automatic retry and a Verified / Corrected / Unverified badge. Unverified replies cannot be saved.
- "Explain with AI" on grammar pages, "Translate with AI" in Look up, "Ask the AI tutor why" in exercises, and saving verified phrases for review.
- Content-Security-Policy limiting connections to the supported providers.
- Shared lesson tools (`tools/library.mjs`, `tools/tool-definitions.mjs`) used by both the site and the MCP server.

### MCP server
- New `mcp/` server exposing the library to AI assistants: six read-only tools, three resources and two prompts.
- Ready-made project configuration for Claude Code (`.mcp.json`), VS Code (`.vscode/mcp.json`) and Cursor (`.cursor/mcp.json`).
- `docs/MCP_GUIDE.md`: an introductory guide to MCP, app setup, a code walkthrough and a checklist for building servers.
- Server tests (in-memory client and stdio), run in CI.

## 1.0.0-rc.1 (October 2026)

First release candidate, ready for native-speaker review.

### Content
- 60 grammar patterns across A1 (24), A2 (20) and B1 (16), each with three example sentences.
- 360 words in 12 topics, with classifiers and usage notes.
- 30 spoken-or-written sentence pairs.
- Printable worksheets: fill the gap (A1, A2, B1), build the sentence, spoken or written.

### Learning site
- Grammar, vocabulary and look-up pages, with Jyutping, Yale or Bopomofo and optional characters.
- Flashcards, fill the gap, build the sentence, tones and spoken-or-written drills.
- Review of missed questions; progress export, import and reset; works offline.

### Quality
- Jyutping → Yale / Bopomofo converter tested against every syllable of the pingyambiu table.
- Build-time validation: syllables, character and syllable counts, written-Chinese forms, duplicates, links and exercises.
- Two-reviewer rule for marking content as reviewed, with issue forms and a review guide.
- Browser tests for every page and journey, run in CI.
