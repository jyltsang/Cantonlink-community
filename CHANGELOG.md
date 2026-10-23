# Changelog

## Unreleased

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
