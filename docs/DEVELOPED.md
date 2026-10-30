# What has been developed

The state of CantonLink Community Edition as of **30 October 2026** (version `1.0.0-rc.2`). This is one of three master documents:

- **What has been developed** (this page): what exists and how it is verified.
- [Master plan](MASTER_PLAN.md): why the project exists, its principles, decisions and roadmap.
- [Next run](NEXT_RUN.md): what the next working session will do.

Each run updates this page (see [the loop](MASTER_PLAN.md#the-self-improvement-loop)). Detailed evidence is in the [quality report](QUALITY_REPORT.md); the history is in the [changelog](../CHANGELOG.md) and the [retrospectives](retrospectives/README.md).

## Summary

| Area | Status |
|---|---|
| Content (A1–B1) | Complete to launch targets, **all entries still "draft"** until native-speaker review |
| Learning site | Live at <https://jyltsang.github.io/Cantonlink-community/>, on brand, offline-capable |
| AI tutor (own key) | Working with Claude, OpenAI, Gemini and OpenAI-compatible servers; Gemini tested live |
| MCP server and CLI | Published on npm as `cantonlink-mcp@1.0.0-rc.2` |
| Data for reuse | `dist/cantonlink-community.json` with a JSON Schema, CC BY-SA 4.0 |
| Automated checks | Content rules, pronunciation cross-check, unit, browser, MCP and contrast tests in CI |
| Needs people | Native-speaker review, screen-reader and device testing, live tests with Claude, OpenAI and Ollama |

## Content

All content is original, in spoken Hong Kong Cantonese, with Jyutping written once by hand; Yale and Cantonese Bopomofo are generated.

| | Count | Where |
|---|---|---|
| Grammar patterns | 60 (A1 24, A2 20, B1 16), each with at least three examples (five at A1), a written-Chinese note where relevant and common mistakes | `content/grammar/` |
| Example sentences | 228 (each A1 pattern has five) | in the patterns |
| Vocabulary | 390 words in 13 topics of 30, with classifiers, usage notes and code-mixed work words (寫 code) | `content/vocabulary/` |
| Learning path | 12 units in teaching order (A1 5, A2 4, B1 3), each with patterns, a topic, an AI scenario and a 6–8 line model dialogue (94 lines) | `content/path.json`, `content/dialogues.json` |
| Spoken or written? | 30 pairs | `content/practice/spoken-or-written.json` |
| Practice items (generated) | fill the gap, build the sentence (14 with accepted alternative orders), tones, flashcards | `dist/` |
| Checked readings | 34 colloquial readings documented against the reference dictionary; 10 readings for characters inside English text | `content/pronunciation-notes.json`, `content/prose-readings.json` |

Scope and level choices are explained in the [curriculum](CURRICULUM.md).

## Learning site (`site/`)

A static site of plain ES modules with no runtime dependencies, built by `tools/site.mjs` and deployed to GitHub Pages.

- **Design:** the CantonLink design system (cream canvas, white cards, ink pill buttons, the jade, hibiscus, persimmon, laicha and inkblue families, Elms Sans and JetBrains Mono), with a dark mode derived from the brand. Every colour pair meets WCAG AA in both themes.
- **Romanisation first:** Jyutping (mono, tone numbers as superscripts; the text is unchanged for copying and screen readers), Yale or Bopomofo. **Characters are off by default and appear nowhere when off**, including grammar names, explanations, notes and topic names; when on, they sit beneath the romanisation.
- **Learn:** grammar by level and function, pattern pages, vocabulary by topic, Look up from English, Jyutping, Yale or characters, with Jyutping conversion.
- **Learning path:** a Continue card, 12 units with progress, unit practice, and model dialogues in two modes: **Try first** (output-first: see the English, say it, reveal it; the default) and **Read**.
- **Practise:** flashcards, fill the gap, build the sentence, tones, and Spoken or written? (only with characters on, since it is about characters).
- **Review:** missed items return on a five-box Leitner schedule (1, 3, 7, 14 days). Progress is kept in the browser, with export and import; no account.
- **Offline:** a service worker caches the whole site after the first visit.

## AI tutor (bring your own key)

Documented in the [AI tutor guide](AI_TUTOR.md).

- Providers: Claude (default `claude-opus-5-5`), OpenAI, Gemini (default `gemini-flash-lite-latest`) and OpenAI-compatible servers including a local Ollama. The key stays in the browser and goes only to the chosen provider; the Content-Security-Policy allows no other host.
- Features: conversation as Friend or Sifu by level and scenario, unit role-play from the model dialogue, Check my sentence, Explain with AI on grammar pages, Translate with AI in Look up.
- Every reply passes eight visible checks (structure, valid Jyutping, characters match syllables, spoken Traditional Cantonese including a Simplified-character check, agreement with the library, real grammar references, romanisation generated locally, optional second opinion) and is badged Verified, Corrected or Unverified. Unverified replies cannot be saved.
- Resilience: two retries for busy providers, a 90-second limit per request, Try again without repeating the message, clear messages for used-up quotas and retired models.
- With characters off, the tutor is asked to write Cantonese words in its explanations in Jyutping.

## MCP server and terminal CLI (`mcp/`)

Documented in the [MCP guide](MCP_GUIDE.md) and `mcp/README.md`.

- Six library tools shared with the site (`tools/tool-definitions.mjs`): vocabulary search, grammar list and detail, Jyutping conversion, the written-Chinese check and practice questions, plus resources and prompts.
- Characters off by default, for learners who do not read them: tools, resources and prompts show Jyutping or Yale only (`--characters=on|off`, `--romanisation=jyutping|yale`, or the `CANTONLINK_*` variables), and the tutor prompt tells the model never to show characters.
- Romanisation-aware search (`searchWords` in `tools/library.mjs`, also used by the site's tutor): tones optional, Jyutping or Yale with or without marks, run-together syllables, l for n, dropped ng-; a wrong tone or a one-letter slip is returned as a labelled closest match.
- `cantonlink` CLI: `word` (search or word of the day), `quiz`, `romanise`.
- Self-contained package (library and data bundled at pack time), published with provenance as `cantonlink-mcp@1.0.0-rc.2`; repository folders are pre-configured for Claude Code, VS Code and Cursor.

## Retrieval example for developers (`examples/rag/`)

Documented in the [RAG guide](RAG_GUIDE.md): how to build a vector index over the library, the project rules it must keep, and how to evaluate it.

- Chunking (one chunk per word, pattern and example, no characters), a local embedding model through transformers.js (no key), brute-force cosine search, hybrid ranking with the library's own search (reciprocal rank fusion) and a stale-index guard.
- 25 evaluation queries (paraphrases, romanisation, grammar by meaning). Keyword search alone: 16% recall@5. Vector and hybrid scores are not yet measured: the model download needs network access that the project's environment lacks.
- Not part of the site or the npm package.

## Data for reuse (`dist/`)

- `cantonlink-community.json`: every pattern, example, word, unit, dialogue and practice item with characters, Jyutping, Yale and Bopomofo, word by word, plus `*Parts` fields for showing text without characters.
- `schema.json`: JSON Schema (draft 2020-12).
- `site-data.json`: a compact copy that `tools/data.mjs` `hydrate()` rebuilds exactly.
- `library/`: readable Markdown pages, an English index and printable worksheets, all generated.

## How it is verified

### Automatically, on every push (CI: `.github/workflows/check.yml`)

| Check | Where |
|---|---|
| Valid Jyutping, one syllable per character, no written Chinese in spoken text, no duplicate words, valid exercises, accepted orders, distractor rules, dialogues use their unit's patterns, the path teaches everything once | `tools/build.mjs` |
| Every reading agrees with an independent dictionary (to-jyutping) or has a documented reason | `tools/check-pronunciation.mjs` |
| Readings for characters inside English text: ambiguous characters need a checked reading; pattern Jyutping lines up with characters | `tools/prose.mjs`, `tools/build.mjs` |
| Generated files and formatting up to date | `npm run check` |
| Romanisation against all ~4,000 pingyambiu syllables; spaced review; AI checks with recorded provider responses; slim data rebuilds the full data; workflows install dependencies | `npm test` |
| WCAG AA contrast for every colour pair, both themes | `tools/contrast.test.mjs` |
| Relative links in the documentation resolve; the three master documents exist and link to each other | `tools/links.test.mjs` |
| Every page and learning journey in Chromium: no errors, no sideways scrolling, no emoji, named buttons; **no Chinese character on any page with characters off**, in Jyutping and Yale; Try first; the AI tutor against a scripted provider | `npm run test:e2e` (31 tests) |
| Every page, in light and dark and with characters on and off, has no serious or critical WCAG 2.2 A/AA violations (axe-core) | `npm run test:e2e` |
| The live AI test itself, against a mock provider | `node tests/live-ai.mjs --local --mock` |
| The MCP package packed, unpacked and run through npm's symlinks; **no Chinese character in any tool result, resource or prompt with characters off**, in Jyutping and Yale | `npm test --prefix mcp` (25 tests) |
| Learner romanisation finds the right word (no tones, Yale, run together, l for n); wrong tones are only approximate | `tools/library.test.mjs` |
| The retrieval example's chunking, index metadata, stale-index guard, fusion and evaluation maths, with a stand-in embedder | `examples/rag/rag.test.mjs` (in `npm test`) |

### By hand

- Proofreading of all content and an audit of every exercise (October 2026): see the [quality report](QUALITY_REPORT.md).
- Live AI test on the deployed site with a paid Gemini key: passed, 20 requests, every reply Verified or Corrected.
- Screenshots on phone and desktop, light and dark, after each visual change.
- No emoji anywhere.

### Not yet verified (needs people)

1. Native-speaker review of all 74 entries (60 patterns, 13 word lists, the spoken-or-written set), two reviewers each ([review guide](REVIEW_GUIDE.md), [status](../library/review-status.md)).
2. Screen readers (VoiceOver, NVDA) and real devices (older Android, iOS Safari).
3. The AI tutor live with Claude, OpenAI and a local Ollama model (needs keys; covered by recorded-response tests meanwhile).

## Infrastructure

| Workflow | Trigger | What it does |
|---|---|---|
| `check.yml` | every push and pull request | unit tests and content checks; browser tests in the Playwright container; MCP package tests |
| `pages.yml` | push to `main` | builds and deploys the site |
| `live-ai.yml` | manual only | real-provider browser test, capped at 40 requests to protect paid keys |
| `publish-mcp.yml` | manual only | tests and publishes `cantonlink-mcp` to npm with provenance (dry run by default) |

Repository secrets in use: `NPM_TOKEN`, `GEMINI_API_KEY`.
