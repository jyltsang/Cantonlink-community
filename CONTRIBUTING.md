# Contributing

Thank you for helping make free Cantonese learning material more reliable. All content is currently a first draft, so the most valuable contributions are **corrections** and **native-speaker review**.

## Ways to help

- **Report an error.** Open an issue naming the pattern or word, what is wrong, and what you would say instead. Every page has a link.
- **Review content.** If you are a native or near-native speaker of Hong Kong Cantonese, open an issue titled "Reviewer". Reviewers are credited by name.
- **Add or improve content.** Edit the JSON in `content/` and open a pull request (see below).

## Content standards

Content follows the quality process in [§8 of the spec](docs/PRODUCT_SPEC.md#8-content-quality--what-flawless-means). In short:

1. **Spoken Hong Kong Cantonese.** Where written Chinese differs, show both and label the written form.
2. **Jyutping is the source of truth.** Write tone numbers (`nei5 hou2`). Never type Yale or Bopomofo: they are generated.
3. **Hong Kong Traditional characters**, used consistently (嘅, 喺, 咗, 啲).
4. **Natural English**, not word-for-word glosses.
5. **Original work only.** Do not copy sentences from textbooks, dictionaries or websites unless their licence allows it, and say where anything came from.

## Editing content

| File | What it holds |
|---|---|
| `content/grammar/A1.json`, `A2.json` | Grammar patterns, one array per level |
| `content/vocabulary/<topic>.json` | One file per topic |
| `content/practice/spoken-or-written.json` | Written vs spoken sentence pairs |
| `content/lexicon.json` | Extra words used only as practice distractors |

Sentences are lists of `[characters, jyutping]` pairs, one per word, with punctuation as a single-item list:

```json
{ "words": [["我", "ngo5"], ["食", "sik6"], ["咗", "zo2"], ["飯", "faan6"], ["。"]], "en": "I've eaten." }
```

Add `"gap": { "word": "咗", "distractors": ["緊", "過", "吓"] }` to use the sentence in the fill-the-gap worksheet. The distractors must be clearly wrong *for the English meaning given*.

Then run:

```sh
npm test        # romanisation tests
npm run build   # validates content and regenerates library/ and dist/
```

Commit both your `content/` change and the regenerated files. Never edit `library/` or `dist/` by hand: CI will reject it.

## Licensing of contributions

By contributing you agree that code is licensed under [MIT](LICENSE) and learning content under [CC BY-SA 4.0](LICENSE-CONTENT).
