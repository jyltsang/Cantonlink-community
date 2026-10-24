# Sprint 1 retrospective (22–24 October 2026)

The first sprint covers the whole project so far: from an empty repository to release candidate 2. It follows the structure of the `complete-sprint` retrospective, adapted for a project without Jira or Confluence: real counts (commits, tests, CI runs, defects) replace story points.

Sources: git history (38 commits), all 80 GitHub Actions runs, the [changelog](../../CHANGELOG.md), the [quality report](../QUALITY_REPORT.md), and the working sessions' notes.

## Executive summary

| | |
|---|---|
| **Duration** | 22 → 24 October 2026 (3 days) |
| **Work delivered** | 13 feature areas (below), 38 commits, about 6,500 lines of code and tests plus the content |
| **Releases** | `1.0.0-rc.1`, `1.0.0-rc.2`; `cantonlink-mcp@1.0.0-rc.2` on npm |
| **Tests at the end** | 73 unit, 30 browser, 20 MCP (from none), plus the live-test self-check |

### Sprint goals

1. A complete A1–B1 library of spoken Cantonese at launch targets: **met** (as drafts).
2. A learning site that is a full programme, not a reference: **met** (path, practice, review, Try first).
3. Optional AI help that cannot quietly teach mistakes: **met** (eight checks, badges; Gemini tested live).
4. Reuse outside the site: **met** (data and schema, MCP server and CLI on npm).
5. Native-speaker review: **not met**; needs people.

### Key metrics

| Metric | Result |
|---|---|
| CI runs | 80: Check content 31 of 36 green, Deploy 31 of 35, Publish 2 of 3, Live AI 1 of 6 |
| Defects found after push | 6 (3 reported by the project owner, 3 found by the next live run) |
| Defects caught before push by tests | several, e.g. a stray "null" text, a race in two browser tests, unspaced romanised words |
| Paid AI spend | one paid Gemini run, 20 requests, about 1–3 US cents |
| Content | 60 patterns, 180 examples, 390 words, 12 units, 94 dialogue lines, 30 pairs; 853 readings cross-checked |

### Top three wins

1. **Checks built into the build, not left to memory.** Written-Chinese detection, the independent pronunciation cross-check, distractor rules, accepted word orders, dialogue pattern use and ambiguous readings all fail the build. Every content problem found by hand became a rule (for example two new distractor rules after the exercise audit).
2. **Real-world testing found what mocks could not.** The live Gemini runs exposed a retired default model, overloaded models, requests that never ended, used-up quotas and Simplified characters slipping past the checks. Each became a fix with a recorded-response test.
3. **One library, many surfaces.** The same tools serve the site, the AI tutor and the MCP server, and the slim site data rebuilds the published file exactly, so the surfaces cannot drift apart.

### Top three challenges

1. **Pushing before running the full CI sequence.** Two failures reached CI and the owner: the Pages deploy did not install the new dependency, and the live self-test broke after a new warning. Both would have been caught locally.
2. **A requirement understood too narrowly.** "Characters not shown by default" was first applied to sentences only; the owner found characters still on grammar and word pages. The fix needed build-time readings for every character inside English text (explanations, notes, pattern and topic names).
3. **Paid and rate-limited external services.** Six live AI runs were needed, four of which failed for reasons outside the code (retired model, overload, quota, a replaced key). Cost rules had to be agreed part-way through.

## Feature areas delivered

| Area | Outcome | Main commits |
|---|---|---|
| Specification, scaffolding, licences | Done | e75db19 |
| Content to launch targets with written-Chinese guard | Done (draft) | 1d27dee, f123aee |
| Review workflow and interactive site | Done | 3f95bc0, 06ade28 |
| MCP server, shared lesson tools | Done | 59acb3f, 6f08b7e |
| AI tutor with visible checks | Done | 820b43b, 46e5136, a320a81 |
| Spaced review (Leitner) | Done | fdb4d73 |
| Learning path and model dialogues | Done | 0960ca3, 64a28ff |
| Tech and work vocabulary (code-mixing) | Done | cc20ae6 |
| Data schema and slim site data | Done | 3a8e340 |
| npm package and CLI | Done, published | 4169647, b13d8dd |
| Pronunciation cross-check, proofreading, exercise audit | Done | 8a3cc72, f7a3c58 |
| Brand design, Try first | Done | a2c2ea0 |
| Characters off everywhere | Done | 9302f16 |

## What went well

**Engineering**
- Plain ES modules with no runtime dependencies: nothing to upgrade, nothing to break, fast to test.
- Generated files are committed and checked (`npm run check`), so `library/` and `dist/` can never silently differ from `content/`.

**Quality**
- Tests were proven to fail before being trusted: the workflow test failed on the old Pages workflow, the contrast test on a weak colour, and the no-characters test with characters on.
- The browser suite checks whole journeys, not just pages: review schedules, export and import, offline use, Try first, the tutor against a scripted provider.

**Security and privacy**
- Keys stay in the browser and the Content-Security-Policy allows only the listed providers; keys are never printed in CI.
- npm publishing uses provenance; the live test caps requests to protect paid keys.

**Product and UX**
- The design moved onto the CantonLink brand with WCAG AA enforced in both themes.
- Output-first practice (Try first) and romanisation-only display match the main audience.

**DevOps**
- Browser tests moved into the Playwright container after an install stalled, which ended a class of flaky failures.
- Expensive workflows (live AI, publishing) are manual only.

**Process**
- Decisions were asked for when they were genuinely the owner's (cost limits, Bopomofo scheme, design interpretation), and recorded.

## What needs improvement

| Issue | Impact | Root cause | Recommendation |
|---|---|---|---|
| Pushes without the full local CI sequence | High: two red CI runs reported by the owner | Running only the suites that seemed relevant | Always run the whole sequence in `CLAUDE.md` before pushing (now a standing rule) |
| Requirements read narrowly | High: a visible gap for the main audience | Testing the feature where it was built, not everywhere it applies | Add a site-wide guard test for each display rule (done for characters); ask "where else does this appear?" |
| Documentation drift | Medium: the spec said 360 words and React; the curriculum said no free-text translation | Status and plans spread across five documents | Three master documents updated every run, and a link check in CI (this sprint) |
| External AI services | Medium: four failed live runs | Model names change and capacity varies | Use model aliases, keep the request cap, and run one live test per change at most |
| Long blocking waits | Low: the owner had to interrupt a wait | Polling in the foreground | Wait in the background and report progress |

## Systemic issues

1. **Verification gaps between local and CI.** Category: DevOps and process. Severity: high. Seen twice (f5a418a, 309664e).
   - Immediate action: the full sequence as a rule in `CLAUDE.md`.
   - Longer term: a single `npm run ci` script that runs everything CI runs, in the same order.
2. **Display rules not enforced site-wide.** Category: product. Severity: high.
   - The no-characters guard now visits every page.
   - Apply the same pattern to any future display setting (for example English on or off).

## Action items

**Critical (next run)**
1. **Add `npm run ci`.** One command that runs every check CI runs. **Done in the housekeeping run** that wrote this retrospective.
2. **Keep the masters current.** Update `DEVELOPED.md` and `NEXT_RUN.md` at the end of every run (the run skill enforces this).

**High (next two or three runs)**
1. **Recruit native-speaker reviewers.** Owner: project owner. Success: the first entries reach "reviewed".
2. **Live AI tests with a second provider.** Run one live test with Claude or OpenAI once a key is available, within the request cap.
3. **Upgrade Playwright.** Move to the current version together with the CI container image.

**Medium**
1. **More examples per pattern.** Five per pattern instead of three, so practice varies more.
2. **Close the B1 gaps** listed in the curriculum: 嘛, 啩, 㗎喇, 先 and 添 at the end of a sentence, and more resultatives.
3. **Accessibility pass** with screen readers, once testers are available.

**Deferred**
- Audio, until community recordings or a checked synthetic voice is decided.
- B2, until review has proved itself on A1–B1.

## Patterns to repeat

- **Turn every manual finding into a rule.** Distractor rules, accepted orders and ambiguous readings all started as hand findings.
- **Prove a test can fail** before relying on it.
- **Shared code across surfaces** (`tools/tool-definitions.mjs`, `tools/data.mjs`).

## Anti-patterns to avoid

- `replaceChildren(a, b)` with possible `null` values: the DOM inserts the text "null". Filter first.
- Asserting on text that CSS transforms (uppercase labels change `innerText`).
- Hard-coding provider model names that providers retire.

## Experiment for the next run

- **Hypothesis:** starting each run from `NEXT_RUN.md`, and ending with this short retrospective, will stop documentation drift and cut CI failures after push to zero.
- **Measure:** CI failures caused by our own pushes, and stale statements found at the next audit.
