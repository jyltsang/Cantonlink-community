# CantoLink Community Edition — Product Specification

| | |
|---|---|
| **Status** | Draft v0.2 — for review |
| **Owner** | CantoLink |
| **Last updated** | 22 October 2026 |
| **Scope** | A free, open, no-account companion to CantoLink for grammar patterns, practice and topic vocabulary |

---

## 1. Summary

CantoLink Community Edition is a free, open web resource for learners of spoken Cantonese. It offers three things and does them carefully: a **grammar pattern library**, **topic vocabulary**, and **self-marking practice** built from both. There is no sign-up, no paywall and no AI cost per visit; it is a static site that works offline and stores progress only in the learner's browser.

The guiding standard is *accuracy before breadth*. A smaller library in which every sentence has been checked by a native speaker is worth more to the community than a large one that teaches written Chinese passed off as Cantonese. "Flawless" in this document therefore means a defined review process (§8), not an aspiration.

The Community Edition complements the paid CantoLink product rather than competing with it: the paid product keeps what genuinely costs money to run (AI conversation, personalised tracking, structured lesson paths), and the Community Edition gives away what the community most lacks — trustworthy reference content.

---

## 2. Problem

Learners of Cantonese face a resource gap that learners of Mandarin do not:

1. **Written vs. spoken confusion.** Much "Cantonese" material is really Standard Written Chinese read aloud. Beginners learn 他是學生 when Hong Kongers say 佢係學生, and nobody tells them.
2. **Fragmented, unreliable free content.** Free resources are scattered across forums, video comments and personal blogs, with inconsistent romanisation and no quality control.
3. **Romanisation inconsistency.** Jyutping, Yale and ad-hoc spellings are mixed freely, so learners cannot cross-reference sources.
4. **Particles and tone are under-taught.** Sentence-final particles (呀, 啦, 喎, 囉, 咩) carry much of Cantonese's meaning, yet most free materials skip them.
5. **Practice requires accounts.** Most interactive practice sits behind sign-ups, trials or subscriptions, which deters casual and heritage learners.

---

## 3. Audience

| Persona | Description | What they need from this |
|---|---|---|
| **Heritage learner** | Grew up hearing Cantonese; understands some, speaks little, reads few characters. | Patterns they half-recognise, explained clearly; romanisation-first; no judgement. |
| **Complete beginner** | Moving to Hong Kong, or has a Cantonese-speaking partner. | A trustworthy starting point: core patterns and everyday vocabulary by situation. |
| **Self-directed intermediate** | Has a textbook or a tutor; wants a reference and extra drills. | Searchable pattern library with good examples; quick practice sessions. |
| **Teacher / community organiser** | Runs a class, meet-up or Discord server. | Stable links to individual patterns and word lists they can share and assign. |

Levels covered at launch: **A1–B1** (CEFR-style, matching CantoLink's existing tagging). B2 and above follow once the review pipeline is proven.

---

## 4. Goals and non-goals

### Goals
- **G1 — Trust.** Every published example sentence is native-reviewed and tagged as spoken Cantonese.
- **G2 — Zero friction.** A learner reaches useful content in one click from a shared link; no account, no cookie banner beyond what the law requires.
- **G3 — Practice that sticks.** Short sessions (≈5 minutes) with immediate feedback and lightweight spaced repetition.
- **G4 — Shareable.** Every pattern, word list and exercise set has a stable, human-readable URL.
- **G5 — Sustainable.** Hosting cost close to zero; content contributions possible from the community.

### Non-goals (v1)
- AI conversation or any per-request AI feature.
- Accounts, cloud sync, leaderboards or social features.
- Character-writing practice or reading curricula.
- Native mobile apps (the site is responsive and installable as a PWA instead).
- C1–C2 content.

---

## 5. Product principles

1. **Spoken Cantonese, labelled as such.** Where a written form differs, show both and explain the difference rather than hide it.
2. **Romanisation-first, one system at a time.** Jyutping is the default; Yale is a global toggle. Characters and English are optional overlays, consistent with the CantoLink app.
3. **Every pattern earns its examples.** Minimum three example sentences per pattern, each covering a different everyday context.
4. **Feedback explains, not just marks.** A wrong answer shows *why*, using the same explanation text as the library.
5. **Small and correct beats large and doubtful.** Content ships only after review (§8).
6. **Accessible by default.** WCAG 2.2 AA; full keyboard use; screen readers announce romanisation sensibly.

---

## 6. Scope — features

### 6.1 Grammar Pattern Library

A browsable, searchable reference of Cantonese sentence patterns.

**Pattern page contents**
- Pattern in characters and romanisation, e.g. `Verb + 咗` · *Verb + zo2*
- One-line meaning ("completed action")
- Plain-English explanation (≤ 80 words), with a "Written Chinese equivalent" note where relevant (e.g. 了 → 咗)
- 3–5 example sentences, each with Jyutping / Yale, characters and English
- "Common mistake" box drawn from the error-correction data (e.g. *我不去* ✗ → *我唔去* ✓)
- Related patterns (e.g. `Verb + 咗` ↔ `Verb + 緊` ↔ `未…`)
- "Practise this pattern" button → a 5-question set targeting it

**Browsing**
- By level (A1 / A2 / B1)
- By function: *asking questions · negation · time and aspect · comparison · cause and condition · requests and politeness · sentence-final particles*
- By situation: *restaurant · shopping · transport · doctor · phone · work · social*
- Search across characters, Jyutping (with or without tone numbers), Yale and English

**Launch content target: 60 patterns (A1 24 · A2 20 · B1 16).**

### 6.2 Topic Vocabulary

Themed word lists for everyday situations.

**Word entry contents**
- Characters, Jyutping, Yale, English
- Part of speech and classifier where relevant (e.g. 枝 for 筆)
- Usage note (register, region, common collocations)
- 1–2 example sentences, cross-linked to any pattern they use
- Audio (see §9.3)

**Launch topics (12):** greetings and courtesy · numbers, money and time · food and dim sum · shopping · transport and MTR · directions · family and people · home and daily routine · health and the doctor · work and the office · weather · feelings.

**Launch content target: ~360 words (≈30 per topic).**

### 6.3 Practice

Self-marking exercises generated from library content, so every exercise is traceable to a reviewed source entry.

| Exercise type | How it works | Source data |
|---|---|---|
| **Flashcards** | Romanisation → meaning (or the reverse); learner self-rates *Again / Hard / Good*. | Vocabulary |
| **Choose the meaning** | Four-option multiple choice; distractors drawn from the same topic. | Vocabulary |
| **Fill the gap** | Sentence with the pattern slot blanked; choose or type the missing word. | Pattern examples |
| **Build the sentence** | Tap word tiles into the correct order. | Pattern examples |
| **Spoken or written?** | Decide whether a sentence is natural spoken Cantonese; explanation shown either way. | Written-spoken and error-correction pairs |
| **Spot the tone** | Hear or read a syllable pair; pick the one with the stated tone. | Vocabulary (minimal pairs subset) |

**Session design**
- Default session: 10 items, ≈5 minutes; selectable topic, pattern or level.
- Typed answers accept Jyutping with or without tone numbers, and Yale with or without diacritics; tones are then shown as a soft correction rather than marked wrong.
- After each item: correct answer, explanation, link to the source pattern or word.
- **Review queue:** a simple Leitner box (5 boxes) in `localStorage` brings back missed items; a "Review due" count appears on the home page.
- Progress export / import as a JSON file, so learners can move devices without an account.

### 6.4 Global features
- Romanisation toggle (Jyutping / Yale), characters toggle, English toggle — remembered per browser.
- Light and dark themes following the system setting.
- Installable PWA with full offline use after first visit.
- Print-friendly pattern and word-list pages for classroom use.

---

## 7. Key user journeys

1. **Shared link → learn → practise.** A learner taps a link to `/grammar/verb-zo2` posted in a Discord server, reads the explanation, toggles characters on, and presses *Practise this pattern* for five questions. Time to first useful content: under 3 seconds on a mid-range phone.
2. **Topic study before a trip.** A beginner opens *Transport and MTR*, flips through flashcards, then runs a 10-item mixed session. Missed words return in tomorrow's review queue.
3. **Teacher assigns homework.** A teacher shares `/practice?pattern=verb-zo2,verb-gan2&count=10`; every student gets the same focused set without signing up.
4. **Heritage learner fixes a habit.** A learner who says 很好 runs *Spoken or written?* and learns to say 好好 / 好 instead, with an explanation linked to the negation and adverb patterns.

---

## 8. Content quality — what "flawless" means

Quality is the product. Each entry moves through a fixed pipeline, and only `published` entries appear on the site.

```
draft ──► linguistic review ──► native-speaker review ──► published
  ▲                │                     │
  └──── changes ◄──┴──────── changes ◄───┘
```

**Acceptance criteria for every published entry**
- [ ] Example sentences are natural spoken Hong Kong Cantonese (confirmed by a native-speaker reviewer).
- [ ] Jyutping validated automatically against the LSHK Jyutping scheme (valid initials, finals and tones 1–6).
- [ ] Yale generated from Jyutping by script, never typed by hand, then spot-checked.
- [ ] Characters use Hong Kong Traditional forms (e.g. 嘅, 喺, 咗, 啲) consistently.
- [ ] Written-Chinese equivalents, where shown, are clearly labelled as written.
- [ ] English translations are natural, not word-for-word glosses.
- [ ] Level tag agrees with the level-assignment guide.
- [ ] Two named reviewers recorded in the entry's metadata.

**Automated checks (CI on every content pull request)**
- JSON schema validation for every entry.
- Jyutping syllable validator and Jyutping → Yale consistency check.
- Duplicate and near-duplicate detection.
- Every exercise item resolves to a published source entry.
- Every cross-link (related pattern, linked word) resolves.

**Corrections from the community** are invited through a "Report an issue" link on every page that pre-fills a GitHub issue with the entry ID.

---

## 9. Data and technical approach

### 9.1 Architecture

A static site with no backend.

```
content/*.json  ──►  build (validate, generate Yale, build search index)  ──►  static HTML/JS  ──►  CDN
                                                                                      │
                                                         browser: localStorage (settings, review queue)
```

- **Front end:** React 19 + Vite, sharing design tokens and components with the CantoLink web app so the two products feel like one family.
- **Rendering:** pre-rendered pages for every pattern, topic and word, for speed and search-engine visibility.
- **Search:** a client-side index built at compile time (no search server).
- **Offline:** a service worker caches the app shell and all content (estimated < 2 MB).
- **Hosting:** Vercel or GitHub Pages; expected cost negligible.
- **Analytics:** privacy-respecting and cookieless (aggregate page views and session completion only), or none.

### 9.2 Content model

Content lives as versioned JSON in the repository, extending the shapes CantoLink already uses in `data/raw/`.

```jsonc
// content/grammar/verb-zo2.json
{
  "id": "verb-zo2",
  "pattern": "Verb + 咗",
  "jyutping": "Verb + zo2",
  "meaning": "completed action",
  "explanation": "Add 咗 after a verb to show the action has been completed...",
  "writtenEquivalent": { "characters": "了", "note": "Written Chinese uses 了; speech uses 咗." },
  "level": "A1",
  "functions": ["time-and-aspect"],
  "situations": ["general"],
  "examples": [
    { "characters": "我食咗飯喇。", "jyutping": "ngo5 sik6 zo2 faan6 laa3.", "english": "I've already eaten." }
  ],
  "commonMistakes": [
    { "incorrect": "我食了飯", "correct": "我食咗飯", "explanation": "了 is written Chinese." }
  ],
  "related": ["verb-gan2", "mei6"],
  "review": { "status": "published", "reviewers": ["…", "…"], "reviewedOn": "2026-11-01" }
}
```

Yale is **not stored**; it is generated from Jyutping at build time so the two can never drift apart.

### 9.3 Audio

Audio matters for tones but is the costliest part to get right.

| Option | Quality | Cost | Recommendation |
|---|---|---|---|
| Browser speech synthesis (`zh-HK`) | Variable; voice unavailable on some devices | Free | v1 fallback only, clearly labelled "computer voice" |
| Pre-generated TTS files at build time | Good, consistent | One-off, small | **v1 default** for vocabulary and examples |
| Community native-speaker recordings (CC BY-SA) | Best | Volunteer time | v2, starting with tone minimal pairs |

### 9.4 Reuse of existing CantoLink assets

| Existing asset | Count | Reuse in Community Edition |
|---|---|---|
| `data/raw/grammar-rules.json` | 48 patterns (A1 12 · A2 12 · B1 10 · B2+ 14) | Seed for the pattern library; A1–B1 entries enter the review pipeline |
| `data/raw/vocabulary.json` | 133 words (A1 53 · A2 20 · B1 22) | Seed for topic lists |
| `data/raw/written-spoken-pairs.json` | 38 pairs | *Spoken or written?* exercises; written-equivalent notes |
| `data/raw/error-correction-pairs.json` | 32 pairs | *Common mistake* boxes; *Spoken or written?* exercises |
| `pingyambiu` romanisation conversion table | ≈4,000 syllables | Jyutping ↔ Yale conversion — CC BY 3.0, usable with attribution (§11.1) |
| Character dictionaries (Jyutping / Yale / Bopomofo) | ≈6,600 entries | **Not reused** until their licence is confirmed (§11.1) |

### 9.5 Content gaps identified in the seed data

An audit of the existing data shows what must be written before launch:

- **Sentence-final particles are missing entirely** (呀, 啦, 喇, 喎, 囉, 咩, 嘅, 㗎). These are essential for natural speech and become a dedicated function category.
- **Core A1 structures are missing:** possessive 嘅, location 喺, classifiers (個, 隻, 本, 枝), giving 畀, and the 未 / …咗未呀？ question.
- **Passive voice** is listed as 被 / 畀人; the published entry should lead with spoken 畀 and treat 被 as written or formal.
- **14 of 48 grammar entries** repeat the explanation in the `english` field instead of giving a meaning; these need a separate one-line meaning.
- **Vocabulary is unevenly spread:** 43 of 133 words sit in a catch-all "general" domain, and several launch topics (family, home, numbers) have little or no coverage.
- **Vocabulary lacks classifiers and parts of speech**, both needed for the word entry design.

Estimated new writing for launch: ~25 patterns and ~250 words, plus review of all reused entries.

---

## 10. Relationship to paid CantoLink

| | Community Edition (free) | CantoLink (paid) |
|---|---|---|
| Grammar library, topic vocabulary, practice | ✅ | ✅ |
| Account and cross-device sync | — (JSON export instead) | ✅ |
| AI conversation partner (Friend / Sifu) | — | ✅ |
| Structured lesson path, news and video | — | ✅ |
| Personalised progress analytics | — | ✅ |

A single, unobtrusive "Want to practise speaking? Try CantoLink" card appears on the home page and at the end of practice sessions. There are no pop-ups, interstitials or nag screens; the Community Edition must stand on its own merit.

---

## 11. Open source and licensing

- **Code:** MIT licence.
- **Original content** (explanations, examples, word lists): CC BY-SA 4.0, so teachers and other projects can reuse it with attribution.
- **Third-party data:** each source must have a compatible licence before it ships (see §11.1).
- **Contributions:** a `CONTRIBUTING.md` with the content schema, a style guide for explanations, the level-assignment guide, and the review process in §8.

The Community Edition lives in its own public repository, separate from the "All rights reserved" CantoLink codebase, so that its open licence is unambiguous. Seed content from CantoLink (§9.4) is owned by CantoLink and is relicensed under CC BY-SA 4.0 as it passes review.

### 11.1 Third-party data audit (October 2026)

| Source | Origin | Licence | Decision |
|---|---|---|---|
| `pingyambiu` conversion table | [kfcd/pingyam](https://github.com/kfcd/pingyam) | CC BY 3.0 | ✅ Usable with attribution in `NOTICE` |
| Character dictionaries (`粵語字典_(耶魯_調符).csv`, `粵語字典_(粵語拼音字_數字).csv`) | Imported into CantoLink in January 2026; original publisher not recorded | Unknown | ⛔ Excluded until the source and its terms are confirmed |
| HKCanCor corpus | [fcbond/hkcancor](https://github.com/fcbond/hkcancor) | CC BY 4.0 | ✅ Usable with attribution if needed |
| words.hk (粵典) | words.hk | Data available on request; terms set by words.hk | Possible replacement for the character dictionaries; requires their permission |

Validation does not depend on the excluded dictionaries: Jyutping syllables can be checked against the LSHK scheme's initials, finals and tones alone, and Yale is derived from `pingyambiu`.

---

## 12. Success metrics

| Metric | Target (6 months after launch) |
|---|---|
| Published, reviewed patterns | ≥ 60 (A1–B1) |
| Published, reviewed words | ≥ 360 |
| Content error reports resolved within 7 days | ≥ 90 % |
| Practice sessions completed / sessions started | ≥ 70 % |
| Returning visitors within 7 days | ≥ 25 % |
| External community contributors with a merged content PR | ≥ 5 |
| Lighthouse performance and accessibility scores (mobile) | ≥ 95 |

---

## 13. Roadmap

| Phase | Duration | Deliverables |
|---|---|---|
| **0 — Foundations** | 2 weeks | ~~Public repository, licences~~ (done), content schema, validators, CI, style guide, reviewer recruitment |
| **1 — Content sprint** | 4 weeks | Seed data migrated and audited; gap content written; first 30 patterns and 180 words through review |
| **2 — Build** | 3 weeks (overlaps phase 1) | Library, topic lists, search, practice engine, review queue, PWA, toggles |
| **3 — Private beta** | 2 weeks | 20–30 learners and 3 teachers; usability sessions; fixes |
| **4 — Public launch** | — | Full launch content; announcement to Cantonese learning communities (r/Cantonese, Discord servers, meet-ups) |
| **5 — Grow** | Ongoing | Community audio recordings, B2 patterns, more topics, translated UI |

---

## 14. Risks and mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Native-speaker review becomes a bottleneck | High | High | Recruit 3–4 reviewers early; review in small batches; ship fewer, reviewed entries rather than delay |
| Errors damage trust | Medium | High | Two-reviewer rule; visible "Report an issue" link; public changelog of corrections |
| Third-party data licence conflict | Medium | High | Audit completed (§11.1); unclear sources excluded; every source listed in `NOTICE` |
| TTS mispronounces tones | Medium | Medium | Manual spot-check of generated audio; flag and re-record; prioritise human recordings for tone exercises |
| Cannibalises paid product | Low | Medium | Free tier covers reference and drills only; AI conversation remains paid and is the clear upgrade path |
| Regional variation disputes (HK vs. Guangzhou usage) | Medium | Low | State Hong Kong Cantonese as the standard; add regional notes where helpful |

---

## 15. Open questions

1. **Branding:** a subdomain such as `learn.cantolink.org`, or a separate name?
2. **Reviewers:** who are the native-speaker reviewers, and are they credited publicly?
3. **Audio budget:** is a one-off TTS generation cost acceptable for v1?
4. **UI languages:** English-only at launch, or also Traditional Chinese for heritage learners' families?
5. **Paid-product link:** is a single home-page card the right level of promotion?

---

## Appendix A — Sample practice items

**Fill the gap** — pattern `Verb + 咗`
> ngo5 sik6 ___ faan6 laa3. — *I've already eaten.*
> ◯ gan2 ◯ **zo2** ◯ gwo3 ◯ hai6
> *Explanation:* 咗 (zo2) marks a completed action. 緊 (gan2) would mean "am eating".

**Spoken or written?**
> 他是學生。
> ◯ Natural spoken Cantonese ◯ **Written Chinese**
> *Explanation:* In speech, say 佢係學生 (keoi5 hai6 hok6 saang1). 他 → 佢, 是 → 係.

**Build the sentence** — *Is there any milk tea?*
> [ naai5 caa4 ] [ jau5 mou5 ] [ aa3 ] [ ? ]
> ✓ jau5 mou5 naai5 caa4 aa3?

## Appendix B — Glossary

- **Jyutping** — romanisation scheme of the Linguistic Society of Hong Kong; tones written as numbers 1–6.
- **Yale** — older romanisation using diacritics and *h* to mark tones; still common in textbooks.
- **Sentence-final particle** — a syllable at the end of a sentence that adds mood or attitude (e.g. 啦 for suggestion, 咩 for surprise).
- **Classifier** — a measure word required between a number and a noun (e.g. 一**個**人, 一**本**書).
- **Leitner box** — a simple spaced-repetition method in which items move between boxes reviewed at increasing intervals.
