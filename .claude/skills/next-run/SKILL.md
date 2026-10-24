---
name: next-run
description: Run the next working session on CantonLink Community Edition through the self-improvement loop - read the master documents, agree scope from docs/NEXT_RUN.md, build and verify, write a retrospective, update the masters and lessons. Use when starting a new run or when asked to "continue the project" or "do the next run".
---

# Next run

The repeatable loop for every working session. The master plan explains why it exists: [docs/MASTER_PLAN.md#the-self-improvement-loop](../../../docs/MASTER_PLAN.md#the-self-improvement-loop).

## 1. Read

Read, in full:
- `CLAUDE.md`: the standing rules and lessons learned;
- `docs/NEXT_RUN.md`: this run's brief;
- `docs/DEVELOPED.md` and `docs/MASTER_PLAN.md`: what exists and what has been decided;
- the latest file in `docs/retrospectives/`.

Then run `npm ci` and `npm run ci` to confirm the starting point is green. If it is not, fixing it is the first item.

## 2. Agree the scope

Summarise for the owner, in a few lines:
- which items from `docs/NEXT_RUN.md` this run will take;
- anything that needs their decision;
- anything that would cost money (paid AI keys).

Ask with the question tool when a choice is genuinely theirs. Do not start paid AI calls without explicit permission.

## 3. Build

- Keep each change small and tested. Write or extend the test first, and show that it fails on the old behaviour.
- Content: edit `content/`, run `npm run build`, and commit the regenerated `library/` and `dist/` with it.
- Any new rule found by hand becomes a build rule or a test, so the problem cannot return.
- Follow the standing rules in `CLAUDE.md`: UK English, no emoji, draft labels, characters off everywhere, the paid-key rules.

## 4. Verify

1. Run `npm run ci`: all of it, every time, before pushing.
2. For visual changes, take screenshots on a phone (390 px) and on desktop, in light and dark, and look at them.
3. Commit with a message that explains why, then push to `main`.
4. Confirm that the `Check content` and `Deploy practice site` runs for the commit are green. Wait in the background, and tell the owner what you are waiting for.

## 5. Look back

Write `docs/retrospectives/sprint-NN.md` (the next number), using the headings of the latest one, kept short:
- summary and metrics: work delivered, tests before and after, CI runs and failures with causes, any AI spend;
- wins and challenges;
- issues with root causes and recommendations;
- action items;
- lessons.

Add it to `docs/retrospectives/README.md`.

## 6. Update the masters

- `docs/DEVELOPED.md`: counts, features, verification, the date and version.
- `docs/NEXT_RUN.md`: remove what was done, keep what was not, and add the retrospective's action items, in order, each with "why", "do", "done when" and files. Keep "waiting on the owner or reviewers" separate.
- `docs/MASTER_PLAN.md`: only if a decision changed; add a line to the decision log.
- `CHANGELOG.md`: an entry under "Unreleased".

The link test (`tools/links.test.mjs`) checks that the masters exist, link to each other, and that every relative link resolves.

## 7. Learn

Add each new lesson as one line at the top of "Lessons learned" in `CLAUDE.md`, tagged with the sprint. A lesson is something that would have saved time or prevented a defect.

## 8. Report

Tell the owner, briefly:
- what was delivered and verified (CI status, links);
- what the retrospective found;
- what the next run will do;
- what is waiting on them.
