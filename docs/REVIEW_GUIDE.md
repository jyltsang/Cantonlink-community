# Review guide

Thank you for reviewing. Your judgement as a native speaker is what turns this draft into material learners can trust.

Every grammar pattern, vocabulary topic and practice set needs **two** independent native-speaker reviews before it loses its draft label. Progress is tracked on the [review status page](../library/review-status.md).

## What to check

For each entry, read the page in [`library/`](../library/README.md) and ask:

**Cantonese**
- [ ] Would a Hong Kong Cantonese speaker actually say each sentence this way, in everyday speech?
- [ ] Is anything written Chinese in disguise (他, 是, 的, 不, 了, 在, 這, 很, 給)?
- [ ] Are the characters the usual Hong Kong Traditional forms (嘅, 喺, 咗, 啲, 嚟, 畀)?
- [ ] Are the particles (呀, 啦, 喇, 咩, 嗎, 㗎) natural in context?

**Jyutping**
- [ ] Is every tone right, including colloquial changed tones (e.g. 名 meng2, 魚 jyu2)?
- [ ] Do the syllables match what people really say, not only the dictionary reading?

You do not need to check Yale or Bopomofo: they are generated from the Jyutping.

**Meaning and teaching**
- [ ] Is the English translation natural and accurate?
- [ ] Is the explanation correct, and not misleading for a beginner?
- [ ] In fill-the-gap questions, is each wrong option clearly wrong *for the English given*? (Shown as `gap.distractors` in the JSON.)
- [ ] Does the level (A1 or A2) feel right?

Hong Kong usage is the standard. Where Guangzhou, Macau or overseas usage differs, a note is welcome, but it is not an error.

## How to submit your review

Choose whichever is easiest for you.

### Option A: comment on an issue (no Git needed)

1. [Volunteer as a reviewer](https://github.com/jyltsang/cantonlink-community/issues/new?template=reviewer.yml) so we can credit you.
2. For each entry with a problem, [report it](https://github.com/jyltsang/cantonlink-community/issues/new?template=content-error.yml).
3. When you have finished an entry, comment on your volunteer issue: *"Reviewed: grammar/zo2-completed — no changes"* or *"Reviewed after corrections in #12"*. A maintainer adds your name.

### Option B: pull request

1. Edit the entry in `content/` directly, fixing anything that needs it.
2. Add your name to the entry's `review.reviewers`. When it has two names, change `status` to `"reviewed"`:
   ```json
   "review": { "status": "reviewed", "reviewers": ["Ada", "Ben"] }
   ```
3. Run `npm run format && npm run build`, commit, and open a pull request.

The build refuses `"reviewed"` with fewer than two names.

## Ground rules

- Only add your name for entries you have checked **in full**.
- If you correct an entry, your review still counts. The second reviewer then checks the corrected version.
- If two reviewers disagree, discuss it on the issue. When it's genuinely variable, keep the more common form and mention the other in the explanation.
- Corrections are contributed under [CC BY-SA 4.0](../LICENSE-CONTENT).
