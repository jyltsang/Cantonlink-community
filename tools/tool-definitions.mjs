// The six lesson tools, defined once in plain JSON Schema. The MCP server
// registers them for AI apps; the website's AI tutor offers them to the
// learner's chosen model. Both run the same `run` functions on the library.

import {
  LEVELS, searchVocabulary, formatWord, listPatterns, findPattern, suggestPatterns, formatPattern,
  convertJyutping, checkSpoken, practiceQuestions,
} from './library.mjs';

const READ_ONLY = { readOnlyHint: true, openWorldHint: false };
const ok = (text) => ({ text, isError: false });
const fail = (text) => ({ text, isError: true });

export const TOOLS = [
  {
    name: 'search_vocabulary',
    title: 'Search vocabulary',
    description: 'Find Cantonese words in the library by English meaning, Jyutping (tone numbers optional), Yale or Chinese characters. Returns characters, Jyutping, Yale, Bopomofo, meaning, classifier and usage notes.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', minLength: 1, maxLength: 100, description: 'English word, Jyutping, Yale or characters, e.g. "thank you", "m4 goi1", "唔該"' },
        limit: { type: 'integer', minimum: 1, maximum: 50, default: 10, description: 'Maximum number of results' },
      },
      required: ['query'],
    },
    annotations: READ_ONLY,
    run(data, { query, limit }) {
      const results = searchVocabulary(data, query, limit);
      if (!results.length) return ok(`No words in the library match "${query}". The library has ${data.vocabulary.reduce((n, t) => n + t.words.length, 0)} everyday words; it is not a full dictionary.`);
      return ok(results.map(formatWord).join('\n\n'));
    },
  },
  {
    name: 'list_grammar_patterns',
    title: 'List grammar patterns',
    description: 'List the grammar patterns in the library, optionally for one level (A1, A2 or B1). Use get_grammar_pattern with an id for details.',
    inputSchema: {
      type: 'object',
      properties: { level: { type: 'string', enum: LEVELS, description: 'Only patterns at this level' } },
    },
    annotations: READ_ONLY,
    run(data, { level }) {
      return ok(listPatterns(data, level).map((p) => `${p.id} [${p.level}] ${p.pattern} — ${p.meaning}`).join('\n'));
    },
  },
  {
    name: 'get_grammar_pattern',
    title: 'Get a grammar pattern',
    description: 'Get one grammar pattern: explanation, written-Chinese equivalent, example sentences in characters, Jyutping, Yale and English, and common mistakes.',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string', minLength: 1, maxLength: 60, description: 'Pattern id from list_grammar_patterns, e.g. "zo2-completed"' } },
      required: ['id'],
    },
    annotations: READ_ONLY,
    run(data, { id }) {
      const pattern = findPattern(data, id);
      if (pattern) return ok(formatPattern(pattern));
      const suggestions = suggestPatterns(data, id);
      return fail(`No pattern with id "${id}".${suggestions.length ? ` Did you mean: ${suggestions.map((p) => p.id).join(', ')}?` : ' Use list_grammar_patterns to see all ids.'}`);
    },
  },
  {
    name: 'romanise_jyutping',
    title: 'Convert Jyutping',
    description: 'Convert Jyutping (with tone numbers 1–6) to Yale and Cantonese Bopomofo, and validate every syllable.',
    inputSchema: {
      type: 'object',
      properties: { jyutping: { type: 'string', minLength: 1, maxLength: 500, description: 'Space-separated Jyutping syllables, e.g. "nei5 hou2"' } },
      required: ['jyutping'],
    },
    annotations: { ...READ_ONLY, idempotentHint: true },
    run(data, { jyutping }) {
      const result = convertJyutping(jyutping);
      if (result.invalid) return fail(`Not valid Jyutping: ${result.invalid.join(', ') || '(empty)'}. Each syllable needs a tone number from 1 to 6, e.g. "nei5".`);
      return ok(`Jyutping: ${result.jyutping}\nYale: ${result.yale}\nBopomofo: ${result.bopomofo}`);
    },
  },
  {
    name: 'check_spoken_cantonese',
    title: 'Check for written Chinese',
    description: 'Check Chinese text meant to be spoken Cantonese for common Standard Written Chinese forms (他, 是, 的, 不, 了, 在…) and suggest the spoken forms. A heuristic: review its suggestions in context.',
    inputSchema: {
      type: 'object',
      properties: { text: { type: 'string', minLength: 1, maxLength: 2000, description: 'Chinese text to check' } },
      required: ['text'],
    },
    annotations: { ...READ_ONLY, idempotentHint: true },
    run(data, { text }) {
      const findings = checkSpoken(text);
      if (!findings.length) return ok('No common written-Chinese forms found.');
      return ok([`Found ${findings.length} written form${findings.length === 1 ? '' : 's'}:`, ...findings.map((f) => `- "${f.written}" in "…${f.context}…" → spoken: ${f.spoken}`)].join('\n'));
    },
  },
  {
    name: 'get_practice_questions',
    title: 'Get practice questions',
    description: 'Get practice questions with answers, to quiz a learner. Ask the questions first and only reveal the answers after the learner replies.',
    inputSchema: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['fill_the_gap', 'build_the_sentence', 'spoken_or_written'], description: 'Kind of exercise' },
        level: { type: 'string', enum: LEVELS, description: 'Level, for fill_the_gap and build_the_sentence' },
        count: { type: 'integer', minimum: 1, maximum: 10, default: 5, description: 'Number of questions' },
      },
      required: ['type'],
    },
    annotations: READ_ONLY,
    run(data, { type, level, count }) {
      const items = practiceQuestions(data, type, { level, count });
      return ok(['QUESTIONS', ...items.map((i) => i.question), '', 'ANSWERS (reveal only after the learner answers)', ...items.map((i) => i.answer)].join('\n'));
    },
  },
];

// A small validator for the subset of JSON Schema used above. The MCP SDK
// validates for itself; the website uses this before running a tool that a
// model asked for, because models sometimes send malformed arguments.
export function validateArguments(schema, args) {
  const input = args && typeof args === 'object' && !Array.isArray(args) ? args : {};
  const value = {};
  const errors = [];
  for (const name of schema.required ?? []) if (input[name] === undefined) errors.push(`"${name}" is required`);
  for (const [name, rule] of Object.entries(schema.properties ?? {})) {
    let v = input[name];
    if (v === undefined) {
      if (rule.default !== undefined) value[name] = rule.default;
      continue;
    }
    if (rule.type === 'integer' && typeof v === 'string' && /^\d+$/.test(v)) v = Number(v);
    if (rule.type === 'string' && typeof v !== 'string') errors.push(`"${name}" must be text`);
    else if (rule.type === 'integer' && !Number.isInteger(v)) errors.push(`"${name}" must be a whole number`);
    else if (rule.enum && !rule.enum.includes(v)) errors.push(`"${name}" must be one of ${rule.enum.join(', ')}`);
    else if (rule.minLength !== undefined && v.length < rule.minLength) errors.push(`"${name}" is too short`);
    else if (rule.maxLength !== undefined && v.length > rule.maxLength) errors.push(`"${name}" is too long`);
    else if (rule.minimum !== undefined && v < rule.minimum) errors.push(`"${name}" must be at least ${rule.minimum}`);
    else if (rule.maximum !== undefined && v > rule.maximum) errors.push(`"${name}" must be at most ${rule.maximum}`);
    else value[name] = v;
  }
  return errors.length ? { errors } : { value };
}

export function runTool(data, name, args) {
  const tool = TOOLS.find((t) => t.name === name);
  if (!tool) return fail(`Unknown tool "${name}". Available tools: ${TOOLS.map((t) => t.name).join(', ')}.`);
  const { value, errors } = validateArguments(tool.inputSchema, args);
  if (errors) return fail(`Invalid arguments for ${name}: ${errors.join('; ')}.`);
  return tool.run(data, value);
}
