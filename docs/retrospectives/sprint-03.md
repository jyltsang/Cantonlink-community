# Sprint 3 retrospective (30 October 2026)

A short content run: two more examples for every A1 pattern (Next run item 1).

## Executive summary

### Key metrics

| Metric | Before | After |
|---|---|---|
| Example sentences | 180 | 228 (every A1 pattern has five) |
| Entries agreeing with the reference dictionary | 853 | 901 (35 documented colloquial readings) |
| Unit / MCP / browser tests | 89 / 25 / 31 | 89 / 25 / 31 |
| AI spend | | none |

### Wins

- The build and the pronunciation cross-check caught all three problems before review: a distractor already in its sentence, the changed tone of 會 in 開緊會, and a disputed reading of 掂.
- Accepted word orders were added where Cantonese allows them (fronted time words, swapped partners with 同 and choices with 定係).

### Challenges

- A build test asserted the order in which the library lists a character's readings; new content changed the order and broke an unrelated test.

## Issues, root causes and recommendations

| Issue | Root cause | Recommendation |
|---|---|---|
| Unrelated build test failed after adding content | The test matched an incidental order of readings | Assert the readings, not their order (done) |
| A reading the reference dictionary disagreed with (掂 dim3) | Two readings are heard and sources differ | When unsure, replace the sentence rather than document a disputed reading; leave it to native reviewers |

## Action items

1. Close the B1 gaps (Next run item 1).
2. The developer platform items, in order.

## Lessons

- Tests on generated data should assert what matters, not incidental order: new content reorders things.
