# Sprint 2 retrospective (30 October 2026)

A short run in one session: the MCP server made Jyutping/Yale-first, a retrieval guide for developers, the developer-platform plan, and three engineering items from Next run (5, 2 and 1, in that order).

## Executive summary

### Sprint goals

- Make the MCP server serve learners who do not read characters.
- Give developers a way to build and measure their own vector index.
- Patch the MCP dependencies, upgrade Playwright, add automated accessibility checks.

### Key metrics

| Metric | Before | After |
|---|---|---|
| Unit tests (`npm test`) | 76 | 89 |
| MCP package tests | 20 | 25 |
| Browser tests | 30 | 31 |
| Serious or critical axe violations | not measured | 0 (one found and fixed) |
| Keyword search recall@5 on 25 learner queries | not measured | 16% |
| AI spend | | none |

### Top three wins

- A guard test reads every tool result, resource and prompt with characters off and fails on any Chinese character, so the MCP server keeps the site's rule.
- Search now finds what learners type: `lei hou`, `mgoi`, `sihk`, Yale with or without marks.
- The axe check found a real defect (the flashcard's name hid its word from speech-input users) on its first run.

### Top three challenges

- Playwright's pinned browser build was missing in the cloud container; every browser test failed until the local runs were pointed at the installed build.
- A failing assertion in the pack test skipped `client.close()`, which left a server process running and made the test run hang instead of fail.
- Hugging Face was blocked, so the retrieval example's real-model scores could not be measured.

## Issues, root causes and recommendations

| Issue | Root cause | Recommendation |
|---|---|---|
| Pack test hung after the default changed | Clean-up ran only on success | Close clients and child processes in `finally` (done for the pack test) |
| Two shell sessions killed by `pkill -f` | The pattern also matched the shell's own command line | Kill by process ID, found with an exact match on the arguments |
| A stale site server held port 8080 | An interrupted CI run left it behind | Check for and stop leftover servers before rerunning |
| Prefix search ignored a tone the learner gave | The old letter-prefix rule stripped tones | Covered by a test; prefixes now respect given tones |

## Action items

1. Run the `examples/rag` evaluation with a real model where Hugging Face is reachable, and record the numbers in the RAG guide.
2. Recognise Hong Kong street spellings (`cha siu bao`, `yum cha`) in search, with tests.
3. Developer platform items, in the order in Next run.

## Lessons

- Put test clean-up in `finally`: a failed assertion that skips closing a child process turns a failure into a hang.
- Never `pkill -f` with a pattern that also appears in your own command; kill by process ID.
- When a pinned Playwright cannot find its browser locally, point `PLAYWRIGHT_BROWSERS_PATH` at a folder that links the installed build, rather than installing browsers or editing the tests.
