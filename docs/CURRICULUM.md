# Curriculum

This page explains what the Community Edition teaches at each level, and why.

## Benchmark

The scope follows the two standard course grammars of Hong Kong Cantonese, by Virginia Yip and Stephen Matthews (Routledge):

- ***Basic Cantonese: A Grammar and Workbook*** for A1–A2
- ***Intermediate Cantonese: A Grammar and Workbook*** for B1. Its units include classifiers, aspect markers, resultative and directional verbs, negation, relative clauses, conditionals, and particles.

Their reference grammar, *Cantonese: A Comprehensive Grammar* (2nd edition, 2010), describes Cantonese "as spoken by native speakers in Hong Kong", which is also the standard used here.

No text or examples are taken from these books. They serve only as a checklist of what a learner needs at each stage. Every sentence in this project is original.

Levels follow the CEFR-style labels used across CantonLink. Cantonese has no official CEFR descriptors, so the labels are a guide to relative difficulty, not a certification.

## What is covered

| Area | A1 | A2 | B1 |
|---|---|---|---|
| **Being and having** | 係, 有 / 冇 | | |
| **Negation** | 唔, 唔好 | | |
| **Questions** | 有冇, A-not-A, 幾多錢, 乜嘢 / 咩, 邊度 / 邊個, 幾時, 定係 | 點解, 點(樣) | |
| **Time and aspect** | 咗, 緊 | 未, 過, 吓, 完, 已經 | 住 |
| **Possession and description** | 嘅 | classifier possession (我部手機) | relative clauses with 嘅 |
| **Location and pointing** | 喺, 呢 / 嗰 + classifier | | |
| **Counting** | number + classifier | | |
| **Wants, needs and ability** | 想, 要 | 識, 可唔可以, 會, 應該, 唔使 | |
| **Degree and comparison** | 好 + adjective | 太…喇, Adj + 過 | 越嚟越, 好似 |
| **Particles** | 呀, 啦, 嗎 | 喇, 咩 | 囉, 喎 |
| **Connecting** | 同 | 都, 畀 (give), 因為…所以 | 如果…就, 雖然…但係, 一…就, 先…再 |
| **Verb complements** | | | 到 / 唔到, 得 + adjective, 晒, 返, directional verbs |
| **Passive** | | | 畀 + doer + verb |

**60 patterns** in all: A1 24, A2 20, B1 16, the launch target in the [master plan](MASTER_PLAN.md).

### Learning path

[`content/path.json`](../content/path.json) puts everything above into 12 units in teaching order (5 at A1, 4 at A2, 3 at B1). Each unit pairs four to six patterns with a vocabulary topic (two in unit 10) and an AI tutor scenario, so learners meet the grammar in a situation where they need it: ordering food (想, 要, 啦, 定係, 乜嘢) or seeing a doctor (應該, 唔使, 會, 因為…所以). Each unit also has a **model dialogue** of 6–8 lines (`content/dialogues.json`) that puts at least three of its patterns to work in the unit's situation; the tutor uses it for role-play. The build checks that every pattern and topic is taught exactly once, that units never go down in level, and that each dialogue really uses its unit's patterns. The readable version is [library/path.md](../library/path.md).

### Vocabulary

There are 13 topics with 30 words each, **390 words** in total: greetings, numbers and time, food and dim sum, shopping, transport, directions, family and people, home and routine, health, work, weather, feelings, and tech and work.

### Code-mixing

Hong Kong speech, especially at work, mixes English words into Cantonese sentences: 我今日要趕 deadline, 個 system 又出 bug. Learners who only know the "pure" Cantonese word (部署 for deploy, 會議 for meeting) often sound formal or fail to understand colleagues. The **Tech and work** topic teaches the common mixed forms alongside the Cantonese ones, with a note where one is more formal.

In the data, the English word is written the same way in the characters and the Jyutping (`"cjk": "寫 code", "jyutping": "se2 code"`). The build checks that the English words match and counts only the Chinese characters against the Jyutping syllables; Yale and Bopomofo keep the English word unchanged.

The topics were chosen for what a newcomer to Hong Kong or a heritage learner needs first. Nouns carry their classifier, because choosing the right classifier is one of the commonest beginner errors.

### Written versus spoken

A recurring thread throughout is the difference between Standard Written Chinese and spoken Cantonese (他 → 佢, 是 → 係, 的 → 嘅, 不 → 唔, 了 → 咗 or 喇). Many learners meet written Chinese first. It is taught through:

- the "Written Chinese" note on each pattern
- the "Common mistakes" boxes
- the 30-item *Spoken or written?* drill

The build also rejects written forms in spoken sentences, so this can't creep back in.

## Deliberately left out (for now)

| Not included | Why |
|---|---|
| Audio | Good Cantonese audio needs native recordings. Synthetic voices often get tones wrong, which would teach errors. Planned with community recordings (see the [master plan](MASTER_PLAN.md)). |
| Character writing | The project is romanisation-first. Characters are off by default and shown only as an optional aid. |
| B2 and above | The review process should prove itself on A1–B1 first. |
| Slang and very regional usage | Kept to widely understood Hong Kong usage. A few common colloquial items are included and labelled (e.g. 頭痕). |
| Free-text translation without a key | Translating arbitrary English needs an AI model, which would cost money to run for everyone. The look-up covers the library's own words; learners who add their own API key can translate any phrase, with the reply checked against the library ([AI tutor guide](AI_TUTOR.md)). |

## Known gaps to address after review

- More B1 particles (嘛, 啩, 㗎喇), and 被 versus 畀 in formal speech.
- Sentence-final 先 and 添, and resultatives beyond 到 / 晒 / 返 (e.g. 好, 低).
- More examples per pattern: three is the minimum, and five would let practice sessions vary more.
