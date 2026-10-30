# Next run

What the next working session will develop. This is one of three master documents:

- [What has been developed](DEVELOPED.md): what exists today and how it is verified.
- [Master plan](MASTER_PLAN.md): purpose, principles, decisions, roadmap and release criteria.
- **Next run** (this page): the next session's brief.

Start the run with the `/next-run` skill (`.claude/skills/next-run/SKILL.md`). It reads this page, agrees the scope with the project owner, and updates it at the end. Items come from the [Sprint 1 retrospective](retrospectives/sprint-01.md), the release criteria and the [curriculum](CURRICULUM.md)'s known gaps.

**Prepared:** 24 October 2026, after Sprint 1.

## Constraints for every run

- UK English, no emoji, nothing marked "reviewed" without two named native speakers.
- Characters off by default and shown nowhere when off; any new text with characters inside it needs readings (`content/prose-readings.json` if ambiguous).
- No paid AI calls unless the owner asks; the live test stays manual, capped at 40 requests.
- Before every push: `npm run ci` must pass. After it: CI and the Pages deploy must be green.

## Goal for the next run

**Accessibility and robustness first, then more practice material.** Take the items in order and stop when the run's time is used; unfinished items stay here.

### 1. Automated accessibility checks

- **Why:** the release criteria need a screen-reader pass, which needs people, but most WCAG failures can be caught automatically first.
- **Do:**
  - add `@axe-core/playwright` as a development dependency;
  - run axe on every page in `tests/e2e.mjs`, in both themes;
  - fix what it finds.
- **Done when:** no serious or critical axe violations on any page, the check runs in CI, and the fixes are listed in the quality report.
- **Files:** `tests/e2e.mjs`, `package.json`, `site/`.

### 2. Upgrade Playwright with its CI image

- **Why:** 1.56.1 is several versions behind (latest 1.64.x).
- **Do:** bump `playwright` in `package.json` and the `mcr.microsoft.com/playwright` image tag in `check.yml` and `live-ai.yml` together.
- **Done when:** the versions match and the browser tests pass locally and in CI.
- **Files:** `package.json`, `.github/workflows/check.yml`, `.github/workflows/live-ai.yml`.

### 3. Two more examples for each A1 pattern

- **Why:** three examples is the minimum; five lets practice vary more. Start with the 24 A1 patterns: 48 sentences.
- **Do:**
  - write original, natural spoken sentences in different everyday contexts, with gaps for fill-the-gap where the rules allow;
  - add accepted word orders where another order is natural.
- **Done when:**
  - the build, pronunciation cross-check and all tests pass;
  - each new sentence has been proofread for tones and naturalness;
  - the quality report has a new section.
- **Files:** `content/grammar/A1.json`, regenerated `library/` and `dist/`.

### 4. Close B1 gaps (first batch)

- **Why:** the curriculum lists missing B1 items.
- **Do:** add sentence-final 先 and 添, and the particles 嘛 and 啩, as new patterns with three examples each. Fit them into existing B1 units (each pattern must be taught exactly once).
- **Done when:**
  - the patterns are on the path;
  - their dialogues still use at least three unit patterns;
  - explanations have readings for characters-off;
  - all checks pass.
- **Files:** `content/grammar/B1.json`, `content/path.json`, possibly `content/dialogues.json`, `content/prose-readings.json`, `docs/CURRICULUM.md`.

### 5. Patch the MCP package dependencies

- **Do:** update `@modelcontextprotocol/sdk` (1.32.2) and `zod` (4.6.7) in `mcp/`, then run the MCP tests. Publishing a new version (rc.3) is the owner's call; ask first.
- **Files:** `mcp/package.json`, `mcp/package-lock.json`.

### Developer platform (roadmap phase 8), in order

Take these after items 1–5 unless the owner reorders them. The design is in the master plan's [Developer platform](MASTER_PLAN.md#developer-platform) section.

### 6. Evaluation set and accuracy-rate command (8a)

- **Why:** principle 10, accuracy is measured, never assumed.
- **Do:**
  - build an evaluation set of English prompts with the expected Jyutping and pattern, drawn from reviewed examples first (drafts labelled as such);
  - write a command that runs it against a developer's own model and key and reports syllables right (tones included), sentences exactly right, replies passing all checks and written-Chinese slips, with and without retrieval;
  - test it against the mock provider only.
- **Done when:** the command runs in CI against the mock provider, and its report labels the score "agreement with reviewed examples" with the model and date.
- **Files:** new `tools/eval-*.mjs` and data, `tests/`, `docs/AI_TUTOR.md`.
- **Rule:** no live run without the owner's consent; the live-test cap applies to the owner's key.

### 7. Confidence labels and the learner flag (8b)

- **Why:** principle 11, the learner is the judge and reviewers confirm.
- **Do:**
  - add the "in the library" or "not in the library" note beside the existing Verified, Corrected and Unverified badges;
  - add a one-step "this sounds wrong" flag that opens a pre-filled GitHub issue form (prompt, answer, model, check results, optional comment), which the learner reviews and submits; never include the key;
  - add the issue form and a reviewer triage guide.
- **Done when:** e2e tests cover the labels and the flag in both themes and with characters off, and the form never contains a key.
- **Files:** `site/tutor.js`, `tools/ai-checks.mjs`, `.github/ISSUE_TEMPLATE/`, `tests/e2e.mjs`, `docs/AI_TUTOR.md`.

### 8. Grammar breakdown tool (8c)

- **Do:** a shared tool that splits a sentence into words with Jyutping, Yale and meaning, and names the library patterns used; offered to the AI tutor and the MCP server, romanisation-only when characters are off.
- **Done when:** unit and MCP tests pass, including the no-characters guard.
- **Files:** `tools/library.mjs`, `tools/tool-definitions.mjs`, `mcp/test/`.

### 9. Dictionary licence checks (8d)

- **Do:** check and record the licences of CC-Canto, CC-CEDICT, rime-cantonese, HKCanCor, words.hk and any Hugging Face datasets from their own sources; update the licensing table. Import nothing until the owner approves a source.
- **Done when:** each candidate has a recorded licence, version, URL and decision.
- **Files:** `docs/MASTER_PLAN.md`, `NOTICE`.

### 10. Retrieval contract (8e)

- **Do:** one `retrieve(query, { kind, limit })` contract over the romanisation-aware search; run the `examples/rag` evaluation with a real embedding model and record the results.
- **Done when:** the contract is tested, and embeddings are adopted only if the hybrid clearly beats keyword search on paraphrases without losing on romanisation.
- **Files:** `tools/library.mjs`, `examples/rag/`, `docs/RAG_GUIDE.md`.

## Waiting on the owner or reviewers (not run work)

| Item | What is needed |
|---|---|
| Native-speaker review of 74 entries | Reviewers (two per entry), recruited through the reviewer issue form |
| Screen-reader and device testing | Testers with VoiceOver, NVDA, an older Android phone and iOS Safari |
| Live AI test with Claude, OpenAI or Ollama | A key added as a repository secret, and permission for one capped run |
| Audio | A decision: community recordings first, or a checked synthetic voice |
| Interface in Traditional Chinese | A decision on whether to offer it |

## At the end of the run

1. Run `npm run ci`, push, and confirm CI and the Pages deploy are green.
2. Write `docs/retrospectives/sprint-NN.md` and add it to the retrospectives index.
3. Update [What has been developed](DEVELOPED.md), rewrite this page for the following run, and update the [master plan](MASTER_PLAN.md) if a decision changed.
4. Add new lessons to `CLAUDE.md`.
