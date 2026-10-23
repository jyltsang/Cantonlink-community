// JSON Schema for dist/cantonlink-community.json, published as dist/schema.json.

const str = (description) => ({ type: 'string', ...(description ? { description } : {}) });
const obj = (properties, required = Object.keys(properties)) => ({ type: 'object', properties, required, additionalProperties: false });
const list = (items, description) => ({ type: 'array', items, ...(description ? { description } : {}) });
const ref = (name) => ({ $ref: `#/$defs/${name}` });
const level = { type: 'string', enum: ['A1', 'A2', 'B1'] };

const romanised = {
  cjk: str('Traditional Chinese characters, as written in Hong Kong'),
  jyutping: str('Jyutping with tone numbers 1–6; the source of truth'),
  yale: str('Yale romanisation with tone marks, generated from the Jyutping'),
  bopomofo: str('Cantonese Bopomofo, generated from the Jyutping'),
};

export const SCHEMA = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'https://github.com/jyltsang/Cantonlink-community/blob/main/dist/schema.json',
  title: 'CantonLink Community data',
  description: 'Grammar patterns, topic vocabulary, a learning path and practice items for spoken Hong Kong Cantonese. English words in code-mixed phrases (寫 code) appear unchanged in every romanisation.',
  type: 'object',
  additionalProperties: false,
  required: ['licence', 'source', 'grammar', 'vocabulary', 'path', 'practice'],
  properties: {
    licence: { const: 'CC BY-SA 4.0' },
    source: str('Repository the data comes from'),
    grammar: list(ref('pattern'), 'Grammar patterns, A1 to B1'),
    vocabulary: list(ref('topic'), 'Vocabulary topics'),
    path: list(ref('unit'), 'Learning path units in teaching order'),
    practice: obj({
      fillGap: list(ref('fillGap')),
      buildSentence: list(ref('buildSentence')),
      spokenOrWritten: obj({ review: ref('review'), items: list(ref('spokenOrWritten')) }),
    }),
  },
  $defs: {
    word: obj(romanised),
    punctuation: obj({ cjk: str('Chinese punctuation mark'), punctuation: str('The same mark in Latin script') }),
    token: { anyOf: [ref('word'), ref('punctuation')], description: 'One word of a sentence, or a punctuation mark' },
    sentence: obj({ ...romanised, en: str('English meaning') }, ['cjk', 'jyutping', 'yale', 'bopomofo']),
    example: obj({ ...romanised, en: str('English meaning'), tokens: list(ref('token'), 'The sentence word by word') }),
    review: {
      type: 'object',
      description: 'Native-speaker review: an entry is reviewed once two native speakers have checked it',
      required: ['status', 'reviewers'],
      properties: { status: { enum: ['draft', 'reviewed'] }, reviewers: list(str()) },
    },
    pattern: obj({
      id: str('Stable identifier, used in links and practice ids'),
      pattern: str('The pattern, e.g. "Verb + 咗"'),
      jyutping: str(),
      meaning: str('Short English meaning'),
      level,
      function: str('Function id, e.g. "aspect"'),
      functionName: str('Function name, e.g. "Time and aspect"'),
      explanation: str(),
      writtenEquivalent: {
        anyOf: [obj({ cjk: str('The Standard Written Chinese form'), note: str() }), { type: 'null' }],
        description: 'The Standard Written Chinese equivalent, where it differs from speech',
      },
      examples: list(ref('example')),
      mistakes: list(obj({ incorrect: str(), correct: ref('sentence'), note: str() })),
      related: list(str('id of a related pattern')),
      review: ref('review'),
    }),
    vocabularyWord: obj({
      ...romanised,
      en: str(),
      pos: str('Part of speech, e.g. noun, verb, phrase'),
      classifier: { ...ref('word'), description: 'The measure word used when counting or pointing' },
      note: str('Usage note'),
    }, ['cjk', 'jyutping', 'yale', 'bopomofo', 'en', 'pos']),
    topic: obj({
      id: str(), title: str(), titleCjk: str(), note: str('Usage note for the whole topic'), review: ref('review'),
      words: list(ref('vocabularyWord')),
    }, ['id', 'title', 'titleCjk', 'review', 'words']),
    unit: obj({
      id: str(), level, title: str(), titleWord: ref('word'),
      scenario: str('AI tutor scenario id'), goal: str('What the learner can do after the unit'),
      patterns: list(str('pattern id')), topics: list(str('topic id')),
    }),
    fillGap: obj({
      id: str('"<pattern id>:<example index>"'), patternId: str(), level, en: str(),
      tokens: list(ref('token')), gapIndex: { type: 'integer', minimum: 0 },
      options: { ...list(ref('word')), minItems: 4, maxItems: 4, description: 'The answer first, then three distractors' },
    }),
    buildSentence: obj({
      id: str(), patternId: str(), level, en: str(), tokens: list(ref('token')),
      accept: list(list(str()), 'Other natural word orders, as lists of the same words (characters only, no punctuation)'),
    }, ['id', 'patternId', 'level', 'en', 'tokens']),
    spokenOrWritten: obj({ written: str('Standard Written Chinese'), spoken: ref('sentence'), changes: str('What changes, e.g. "他 → 佢"') }),
  },
};
