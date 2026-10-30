# Master plan

Why CantonLink Community Edition exists, what it stands for, the decisions that shape it, and where it is going. This is one of three master documents:

- [What has been developed](DEVELOPED.md): what exists today and how it is verified.
- **Master plan** (this page): purpose, principles, decisions, roadmap and release criteria.
- [Next run](NEXT_RUN.md): what the next working session will do.

This page replaces the former product specification and release checklist (October 2026). It changes only when a decision changes; each change is noted in the [decision log](#decision-log).

## Summary

A free, open resource for learning **spoken Hong Kong Cantonese**, from A1 to B1: a grammar pattern library, topic vocabulary, a guided learning path and self-marking practice, with an optional AI tutor that uses the learner's own API key. No sign-up, no paywall, no cost to run per visit: a static site that works offline and keeps progress in the browser.

It is also an open **developer platform**: developers bring their own model and key, build on the library through the AI tutor, the MCP server and the open data, and help measure how accurate AI Cantonese really is (see [Developer platform](#developer-platform)).

The guiding standard is **accuracy before breadth**. A smaller library in which every sentence is checked is worth more than a large one that teaches written Chinese read aloud. "Flawless" means a defined process (the [quality bar](#quality-bar)), not an aspiration.

## The problem

1. **Written versus spoken confusion.** Much "Cantonese" material is Standard Written Chinese read aloud: 他是學生 where Hong Kong people say 佢係學生.
2. **Fragmented, unreliable free content,** with inconsistent romanisation and no quality control.
3. **Romanisation chaos:** Jyutping, Yale and ad-hoc spellings mixed freely.
4. **Particles and tones under-taught,** though they carry much of the meaning.
5. **Practice behind accounts,** which deters casual and heritage learners.

## Audience

Learners without a character background are the people the project **serves**: everything is built Jyutping and Yale first. Developers in the open community are the people it **builds with**: they bring their own models and keys, so the developer platform is the next phase of work after the Jyutping/Yale-first MCP server.

| Persona | Needs |
|---|---|
| **Developers in the open community** | Plug in their own model and key through the AI tutor or the MCP server; open data, a retrieval guide, evaluation sets and published scores to build on |
| **Non-character learners** (the main audience): newcomers, partners of Cantonese speakers, heritage learners who read few characters | Romanisation only, with no characters unless they choose them; patterns explained plainly |
| **Complete beginners** | A trustworthy starting point and a path to follow |
| **Self-directed intermediates** | A searchable reference and quick drills |
| **Teachers and community organisers** | Stable links to patterns, word lists and worksheets |

## Goals and non-goals

**Goals**
- **Trust:** every sentence is natural spoken Cantonese, checked automatically now and by two native speakers before it loses its draft label.
- **Zero friction:** useful content in one click from a shared link; no account.
- **Output first:** learners try to say things before they are shown (Try first), and practise in short sessions with immediate feedback and spaced review.
- **Shareable and reusable:** stable URLs, printable worksheets, open data with a schema, an MCP server.
- **Sustainable:** hosting cost close to zero; AI only with the learner's own key.

**Non-goals (v1)**
- AI paid for by the project, accounts, cloud sync, leaderboards or social features.
- Character-writing practice or reading curricula.
- Native mobile apps (the site is installable and works offline).
- B2 and above, until review has proved itself on A1–B1.

## Principles

1. **Spoken Cantonese, labelled as such.** Where the written form differs, show both and explain.
2. **Romanisation first.** Jyutping by default, Yale or Bopomofo by choice. Characters are an optional aid, **off by default, and never shown anywhere when off**.
3. **Jyutping is written once, by a person;** Yale and Bopomofo are generated, so systems never disagree.
4. **Every pattern earns its examples:** at least three, in different everyday contexts.
5. **Feedback explains,** using the library's own text, and links to the source.
6. **Small and correct beats large and doubtful.**
7. **Accessible by default:** WCAG 2.2 AA, full keyboard use, sensible screen-reader output.
8. **On brand:** the CantonLink design system, in light and dark.
9. **AI is checked, never trusted:** every AI reply is checked against the library and labelled.
10. **Accuracy is measured, never assumed.** Every claim about AI quality has a number behind it, and every number says what it measures: agreement with reviewed examples, not "correctness".
11. **The learner is the judge; reviewers confirm.** Automatic checks measure agreement with the library, not naturalness. Learners see how far to trust each answer and can flag a doubt in one step; native reviewers decide what changes.

## Quality bar

Every entry moves through: **draft → automatic checks → proofreading → native-speaker review (two people) → reviewed.** Draft entries are published with a visible "Draft" label; nothing is marked reviewed without two named reviewers.

Entries imported from an external dictionary have a third status, **external, unreviewed**. They carry their source and licence, are shown apart from library entries, never count towards review targets, and never ground the AI unless labelled as such. They move into the library only by the same review path as any other entry.

Acceptance criteria for a reviewed entry:
- natural spoken Hong Kong Cantonese, confirmed by two native speakers;
- valid Jyutping with colloquial tones, agreeing with the independent dictionary or documented;
- Hong Kong Traditional characters used consistently (嘅, 喺, 咗, 啲);
- written-Chinese forms shown only when labelled as written;
- natural English, not word-for-word glosses;
- the level agrees with the [curriculum](CURRICULUM.md).

The automatic checks are listed in [What has been developed](DEVELOPED.md#how-it-is-verified). Community corrections come through the "Report it" link on every page.

## Architecture

```
content/*.json  ──►  tools/build.mjs  ──►  library/*.md, dist/*.json  (validated, romanised, readings checked)
                                              │
                         tools/site.mjs ──► _site/  (static ES modules, service worker)  ──►  GitHub Pages
                                              │
                         browser: localStorage (settings, progress, optional AI key)  ──►  learner's AI provider
mcp/  ──► the same library and data, packaged for npx
```

- No framework and no runtime dependencies on the site; the build uses two development packages (to-jyutping, opencc-js).
- One set of library tools (`tools/tool-definitions.mjs`) serves the site's AI tutor and the MCP server.
- Content shapes and editing rules are in [CONTRIBUTING](../CONTRIBUTING.md).
- Retrieval: the library's own search is romanisation-aware and needs no embeddings. Developers who want a vector index follow the [RAG guide](RAG_GUIDE.md) and its runnable example in `examples/rag/`, which is not part of the site or the npm package.

## Developer platform

Developers plug in their own model and key and build on the library; learners without a character background are the end users, so Jyutping and Yale come first. Principles 9–11 apply throughout, and the data, evaluation sets, scores and flags are public, with contributors credited.

1. **Grounded translation and grammar breakdown.** English in, spoken Hong Kong Cantonese out, in Jyutping and Yale (Yale always generated). A breakdown tool splits a sentence into words with readings and meanings and names the library patterns it uses. Output passes the existing checks in `tools/ai-checks.mjs` before it is shown.
2. **Vocabulary bank and external dictionaries.** The native-reviewed library remains the core. External open dictionaries may be added only with a licence compatible with CC BY-SA 4.0, as **external, unreviewed** entries (see [Quality bar](#quality-bar) and [Licensing](#licensing)).
3. **Retrieval, ready for RAG.** One contract, `retrieve(query, { kind, limit })`, returning entries with a score and an "approximate" flag. Today it is the romanisation-aware search; an embedding backend may be added behind it once the vocabulary outgrows keyword search, and only if the evaluation shows a gain. The [RAG guide](RAG_GUIDE.md) shows developers how to build and measure their own.
4. **Accuracy rate.** An evaluation set of English prompts with the expected Jyutping and pattern, drawn first from reviewed examples. Metrics: syllables right (tones included), sentences exactly right, replies passing all checks, written-Chinese forms slipping in, each with and without retrieval. A command developers run with their own model and key produces one public score per model, with the model name and date, labelled "agreement with reviewed examples".
5. **Confidence and flags.** One label scheme, extending the existing badges rather than adding a second set:
   - the badge says whether the reply passed its checks: **Verified**, **Corrected**, or **Unverified** (which also covers a flagged reply);
   - a note says where it stands against the library: **in the library** (grounded in entries, with their draft or reviewed status) or **not in the library** (valid but unverified);
   - search results that only match by a different tone or spelling are labelled **closest match**.

   A one-step "this sounds wrong" flag on any answer opens a pre-filled GitHub issue form with the prompt, the answer, the model, the check results and an optional comment. The learner sees exactly what will be posted and submits it themselves; the key is never included. Native reviewers triage flags; confirmed fixes enter the library and confirmed failures become evaluation cases. Flag counts per model are published beside the accuracy rate.
6. **Community.** Contributor guides for adding evaluation cases, proposing dictionary sources (with a licence check) and reviewing flags; contributors credited by name.

## Decision log

| Date | Decision |
|---|---|
| Oct 2026 | Static site with plain ES modules instead of the originally specified React and Vite: no build step for the site, nothing to keep up to date. |
| Oct 2026 | Keep the project's **Cantonese** Bopomofo scheme (documented in `library/romanisation.md`). The CantoLink app's CMS derives Bopomofo from Mandarin pinyin and should reuse `tools/romanise.mjs`. |
| Oct 2026 | Add an **AI tutor with the learner's own key** (reversing the original "no AI" non-goal) because it costs the project nothing and every reply is checked and labelled. |
| Oct 2026 | **Paid-key rule:** live AI tests are manual only, capped at 40 requests, default to the cheapest model, and at most one run without asking the key's owner. |
| Oct 2026 | Publish drafts with a visible label rather than hold everything back until review. |
| 24 Oct 2026 | Adopt the **CantonLink design system** from Claude Design, with a brand-derived dark mode. |
| 24 Oct 2026 | **Characters off by default and shown nowhere when off**; Spoken or written? appears only with characters on. |
| 24 Oct 2026 | **Try first** (output-first) is the default dialogue mode. |
| 24 Oct 2026 | Planning is kept in three master documents with a retrospective after every run. |
| 30 Oct 2026 | The **MCP server shows characters off by default**, Jyutping or Yale first, matching the site. |
| 30 Oct 2026 | **No vector database for the library itself:** at about 630 chunks, romanisation-aware search is cheaper, testable and better at what learners type. Embeddings may come later behind a retrieval contract, only if an evaluation shows a gain; developers who want their own index follow the [RAG guide](RAG_GUIDE.md). |
| 30 Oct 2026 | **Developer platform:** developers are the people the project builds with, learners without characters the people it serves. Accuracy is published as measured agreement, and learners can flag doubts for reviewers. |
| 30 Oct 2026 | **External dictionaries** only with a licence compatible with CC BY-SA 4.0, as a separate "external, unreviewed" status. |

## Relationship to CantonLink

| | Community Edition (free) | CantonLink app (paid) |
|---|---|---|
| Grammar, vocabulary, practice, learning path | Yes | Yes |
| AI conversation | With the learner's own key, checked | Hosted, no key needed |
| Account and sync | No (export and import) | Yes |
| News, video, personalised plans | No | Yes |

## Licensing

- Code: MIT. Original content: CC BY-SA 4.0. Third-party data is listed in `NOTICE`.
- The repository is separate from the "All rights reserved" CantoLink codebase so the open licence is unambiguous.

Third-party data audit (October 2026):

| Source | Licence | Decision |
|---|---|---|
| pingyambiu conversion table (kfcd/pingyam) | CC BY 3.0 | Used, with attribution |
| to-jyutping (CanCLID) | BSD-2-Clause | Development dependency for the pronunciation cross-check and readings |
| opencc-js | MIT (data Apache-2.0) | Development dependency to generate the Simplified-character list |
| CantoLink's imported character dictionaries | Unknown origin | Excluded |
| HKCanCor (CC BY 4.0), words.hk (by permission) | | Possible future sources; words.hk only if its terms allow this use |
| CC-Canto, CC-CEDICT (with CC-Canto readings), rime-cantonese, Hugging Face datasets | To be verified per source | Candidates for the external vocabulary bank; each licence to be checked before any import |
| HongKongvision converter | Not open data | Reference only; no data used |

## Roadmap

| Phase | Status |
|---|---|
| 0. Foundations: repository, licences, content model, validators, CI | Done |
| 1. Content to launch targets (60 patterns, 390 words, 12 units with dialogues) | Done, as drafts |
| 2. Learning site, practice, review, offline, learning path | Done |
| 2b. AI tutor (own key), MCP server and CLI on npm, open data with schema | Done |
| 2c. Brand design, romanisation-first display, Try first | Done |
| 2d. Jyutping/Yale-first MCP server, romanisation-aware search, RAG guide for developers | Done, awaiting merge to `main` |
| 3. Native-speaker review of all 74 entries | **Waiting on reviewers** |
| 4. Accessibility and device testing (screen readers, older phones) | **Waiting on testers** |
| 5. Private beta with 20–30 learners and a few teachers | Not started |
| 6. Public launch (1.0.0) | After phases 3–5 |
| 7. Grow: community audio, more examples per pattern, B1 gaps, B2, translated interface | Later |
| 8. [Developer platform](#developer-platform): (a) evaluation set and accuracy-rate command; (b) confidence labels and the learner flag, with the review queue; (c) grammar breakdown tool; (d) dictionary licence checks, then imports with source tags; (e) retrieval contract, with embeddings only if the evaluation justifies them | Next, alongside phases 3–5 |

## Release criteria for 1.0.0

- [ ] Every entry reviewed by two native speakers, or kept clearly labelled as draft
- [ ] Screen-reader and device findings fixed
- [ ] The AI tutor tested live with at least two providers
- [ ] CI green, changelog updated, a GitHub release created from `main`

## Success metrics (six months after launch)

| Metric | Target |
|---|---|
| Reviewed patterns / words | ≥ 60 / ≥ 360 |
| Error reports resolved within 7 days | ≥ 90% |
| Practice sessions completed / started | ≥ 70% |
| Community contributors with a merged content change | ≥ 5 |
| Lighthouse performance and accessibility (mobile) | ≥ 95 |
| Models with a published accuracy rate | ≥ 3 |
| Learner flags triaged by a reviewer within 14 days | ≥ 90% |

## Risks

| Risk | Mitigation |
|---|---|
| Native review becomes a bottleneck | Recruit reviewers early; review in small batches; keep drafts labelled |
| Errors damage trust | Automatic checks, visible draft labels, a Report link on every page |
| AI replies teach mistakes | Eight checks per reply, Verified/Corrected/Unverified badges, Unverified cannot be saved |
| AI costs on a learner's or the owner's key | Own-key only; request caps in tests; cheapest default model |
| Documentation drifts from the code | Three master documents updated every run; a link check in CI |
| An external dictionary's licence does not allow reuse | Check and record every licence before import; tag every entry with its source |
| A public flag exposes what a learner typed | The learner sees and submits the issue themselves; no key or personal data is added automatically |
| Published scores are read as "correctness" | Label them as agreement with reviewed examples, with the model, date and evaluation set |

## Open questions

1. Who are the native-speaker reviewers, and how are they recruited?
2. Audio: community recordings first, or a carefully checked synthetic voice for vocabulary?
3. Should the interface also be offered in Traditional Chinese for heritage learners' families?

## The self-improvement loop

Every working session ("run") follows the same loop, written as a project skill in [`.claude/skills/next-run/SKILL.md`](../.claude/skills/next-run/SKILL.md), with standing rules in [`CLAUDE.md`](../CLAUDE.md):

1. **Read** the three master documents and `CLAUDE.md`.
2. **Agree the scope** of the run from [Next run](NEXT_RUN.md) with the project owner.
3. **Do the work** with tests first, keeping each change small.
4. **Verify:** the full local CI sequence, then push and confirm CI and the Pages deploy are green.
5. **Look back:** write a short retrospective in `docs/retrospectives/`.
6. **Update** [What has been developed](DEVELOPED.md) and [Next run](NEXT_RUN.md), and this plan if a decision changed.
7. **Learn:** add any new lesson to `CLAUDE.md`, so the next run starts wiser.
