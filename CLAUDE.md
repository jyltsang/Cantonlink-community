# CantonLink Community Edition

Free, open lessons and practice for **spoken Hong Kong Cantonese** (A1–B1), in Jyutping, Yale or Bopomofo: a content library, a static learning site, an optional AI tutor with the learner's own key, and an MCP server on npm. Start every session with the three master documents:

- [docs/DEVELOPED.md](docs/DEVELOPED.md): what exists and how it is verified
- [docs/MASTER_PLAN.md](docs/MASTER_PLAN.md): purpose, principles, decisions, roadmap
- [docs/NEXT_RUN.md](docs/NEXT_RUN.md): what this run should do

To work through the next run, use the `/next-run` skill (`.claude/skills/next-run/SKILL.md`).

## Standing rules

- **Writing:** UK English (C1–C2), no emoji anywhere (site, docs, commits). Ask when a request is unclear.
- **Content:** spoken Hong Kong Cantonese, never written Chinese read aloud. Jyutping is written by hand; Yale and Bopomofo are generated. Every entry stays `"draft"` until two named native speakers review it; never mark anything reviewed.
- **Characters:** off by default and shown **nowhere** when off. Any text with characters inside it needs readings (the build works them out; add ambiguous ones to `content/prose-readings.json`). New display rules get a site-wide e2e guard.
- **Paid AI keys:** no live AI calls unless the owner asks. The live test is manual only, capped at 40 requests, cheapest model by default, and at most one run without asking.
- **Design:** the CantonLink design system in `site/styles.css`; colours through role tokens; WCAG AA enforced by `tools/contrast.test.mjs`.
- **Git:** work on `main` and push there. Commit messages explain why. Never commit `live-ai-report.json`, keys or the design export.

## Commands

```sh
npm ci                      # once per session
npm run build               # validate content, regenerate library/ and dist/ (commit both)
npm run ci                  # everything CI runs; must pass before every push
npm run preview             # site at http://localhost:8080
```

`npm run ci` runs: `npm test`, `npm run check` (formatting, generated files, pronunciation cross-check), `npm test --prefix mcp`, `npm run test:e2e`, and the live test against the mock provider. After pushing, confirm the `Check content` and `Deploy practice site` runs are green.

## Where things live

| Path | What |
|---|---|
| `content/` | The source of truth (JSON); edit here, never `library/` or `dist/` |
| `tools/build.mjs` | Validation and generation; `tools/prose.mjs` readings; `tools/romanise.mjs` converters |
| `site/` | The learning site (plain ES modules, no dependencies) |
| `tools/ai-*.mjs`, `site/tutor.js` | The AI tutor and its checks |
| `mcp/` | The npm package `cantonlink-mcp` |
| `tests/e2e.mjs` | Browser tests (Playwright); `tests/live-ai.mjs` real-provider test |
| `docs/retrospectives/` | One retrospective per run |

## Lessons learned

Add a line whenever a run teaches something; keep the newest first.

- Tests on generated data should assert what matters, not incidental order: new content reorders things. (Sprint 3)
- Put test clean-up (closing clients, killing child processes) in `finally`: a failed assertion that skips it turns a failure into a hang. (Sprint 2)
- Never `pkill -f` a pattern that also appears in your own command line; kill by process ID. (Sprint 2)
- If a pinned Playwright cannot find its browser locally, point `PLAYWRIGHT_BROWSERS_PATH` at a folder linking the installed build; do not install browsers or edit the tests. (Sprint 2)
- Characters-off was first applied only to sentences; grammar names and notes still showed characters. Guard display rules on every page, not where the feature was built. (Sprint 1)
- Two CI failures came from pushing without the full local sequence. Run `npm run ci` before every push. (Sprint 1)
- `element.replaceChildren(a, b)` inserts the text "null" for null arguments; filter first. (Sprint 1)
- `innerText` reflects CSS `text-transform`; assert case-insensitively on uppercase labels. (Sprint 1)
- Provider model names get retired; prefer aliases (`gemini-flash-lite-latest`) and warn when a chosen model is missing. (Sprint 1)
- A Pages or CI job that runs the build must `npm ci` first, since the build has development dependencies. (Sprint 1)
- Prove a new test fails on the bug before trusting it. (Sprint 1)
- Wait for long jobs in the background and keep the owner informed. (Sprint 1)
