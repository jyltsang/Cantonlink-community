# Sprint 4 retrospective (30 October 2026)

A short content run: the first batch of B1 gaps (Next run item 1).

## Executive summary

### Key metrics

| Metric | Before | After |
|---|---|---|
| Grammar patterns | 60 (B1 16) | 63 (B1 19) |
| Example sentences | 228 | 238 |
| Reviewable entries | 74 | 77 |
| Entries agreeing with the reference dictionary | 901 | 912 |
| Unit / MCP / browser tests | 89 / 25 / 31 | 90 / 25 / 31 |
| AI spend | | none |

### Wins

- 添, 嘛 and 啩 are on the path in the units where learners need them (work, plans, stories); every reading agreed with the reference dictionary first time.
- Looking at the real output with characters off found a defect the tests had missed since Sprint 2: adjacent readings ran together (keoi5hou2gou1). It is fixed and guarded.

### Challenges

- Sentence-final 先 was listed as a gap but was already taught. Checking the existing pattern first avoided teaching it twice.
- A planned mistake note (我先食 as wrong) contradicted the pattern's own example and was dropped before release.
- A note that contrasts two characters (嘛 and 嗎) says nothing to a learner who sees only romanisation, since both are maa3; it was reworded.

## Issues, root causes and recommendations

| Issue | Root cause | Recommendation |
|---|---|---|
| Readings run together in MCP output | The formatter joined parts without the space the site adds | Reuse the site's rule; a test now checks every pattern |
| A gap that was not a gap | The curriculum list was not checked against the patterns | Search existing patterns before adding one |
| A note that only works with characters | Written for character readers | Read new notes with characters off before committing |

## Action items

1. The developer platform items, in order (Next run).
2. Read every new note and explanation with characters off as part of proofreading.

## Lessons

- Look at real output with characters off, not only at tests: a missing space between readings passed every test for two sprints.
