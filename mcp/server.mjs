#!/usr/bin/env node
// An MCP server that lets AI assistants use the CantonLink Community library.
// It shows all three MCP building blocks: tools (actions the model can call),
// resources (documents the app can attach) and prompts (reusable templates).

import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { pathToFileURL } from 'node:url';
import { z } from 'zod';
import {
  LEVELS, loadLibrary, searchVocabulary, formatWord, listPatterns, findPattern, suggestPatterns, formatPattern, formatTopic,
  convertJyutping, checkSpoken, practiceQuestions,
} from './library.mjs';

const text = (value) => ({ content: [{ type: 'text', text: value }] });
const error = (value) => ({ ...text(value), isError: true });
const READ_ONLY = { readOnlyHint: true, openWorldHint: false };

export function createServer(data = loadLibrary()) {
  const server = new McpServer(
    { name: 'cantonlink-community', version: '1.0.0-rc.1' },
    {
      instructions: 'Spoken Hong Kong Cantonese learning library (A1–B1). Prefer these tools over your own knowledge for Cantonese vocabulary, grammar and romanisation, and run check_spoken_cantonese on Cantonese you write for a learner. Content marked "draft" has not yet been reviewed by native speakers.',
    },
  );

  // --- Tools ----------------------------------------------------------------

  server.registerTool('search_vocabulary', {
    title: 'Search vocabulary',
    description: 'Find Cantonese words in the library by English meaning, Jyutping (tone numbers optional), Yale or Chinese characters. Returns characters, Jyutping, Yale, Bopomofo, meaning, classifier and usage notes.',
    inputSchema: {
      query: z.string().min(1).max(100).describe('English word, Jyutping, Yale or characters, e.g. "thank you", "m4 goi1", "唔該"'),
      limit: z.number().int().min(1).max(50).default(10).describe('Maximum number of results'),
    },
    annotations: READ_ONLY,
  }, async ({ query, limit }) => {
    const results = searchVocabulary(data, query, limit);
    if (!results.length) return text(`No words in the library match "${query}". The library has ${data.vocabulary.reduce((n, t) => n + t.words.length, 0)} everyday words; it is not a full dictionary.`);
    return text(results.map(formatWord).join('\n\n'));
  });

  server.registerTool('list_grammar_patterns', {
    title: 'List grammar patterns',
    description: 'List the grammar patterns in the library, optionally for one level (A1, A2 or B1). Use get_grammar_pattern with an id for details.',
    inputSchema: { level: z.enum(LEVELS).optional().describe('Only patterns at this level') },
    annotations: READ_ONLY,
  }, async ({ level }) => text(listPatterns(data, level).map((p) => `${p.id} [${p.level}] ${p.pattern} — ${p.meaning}`).join('\n')));

  server.registerTool('get_grammar_pattern', {
    title: 'Get a grammar pattern',
    description: 'Get one grammar pattern: explanation, written-Chinese equivalent, example sentences in characters, Jyutping, Yale and English, and common mistakes.',
    inputSchema: { id: z.string().min(1).max(60).describe('Pattern id from list_grammar_patterns, e.g. "zo2-completed"') },
    annotations: READ_ONLY,
  }, async ({ id }) => {
    const pattern = findPattern(data, id);
    if (pattern) return text(formatPattern(pattern));
    const suggestions = suggestPatterns(data, id);
    return error(`No pattern with id "${id}".${suggestions.length ? ` Did you mean: ${suggestions.map((p) => p.id).join(', ')}?` : ' Use list_grammar_patterns to see all ids.'}`);
  });

  server.registerTool('romanise_jyutping', {
    title: 'Convert Jyutping',
    description: 'Convert Jyutping (with tone numbers 1–6) to Yale and Cantonese Bopomofo, and validate every syllable.',
    inputSchema: { jyutping: z.string().min(1).max(500).describe('Space-separated Jyutping syllables, e.g. "nei5 hou2"') },
    annotations: { ...READ_ONLY, idempotentHint: true },
  }, async ({ jyutping }) => {
    const result = convertJyutping(jyutping);
    if (result.invalid) return error(`Not valid Jyutping: ${result.invalid.join(', ') || '(empty)'}. Each syllable needs a tone number from 1 to 6, e.g. "nei5".`);
    return text(`Jyutping: ${result.jyutping}\nYale: ${result.yale}\nBopomofo: ${result.bopomofo}`);
  });

  server.registerTool('check_spoken_cantonese', {
    title: 'Check for written Chinese',
    description: 'Check Chinese text meant to be spoken Cantonese for common Standard Written Chinese forms (他, 是, 的, 不, 了, 在…) and suggest the spoken forms. A heuristic: review its suggestions in context.',
    inputSchema: { text: z.string().min(1).max(2000).describe('Chinese text to check') },
    annotations: { ...READ_ONLY, idempotentHint: true },
  }, async ({ text: input }) => {
    const findings = checkSpoken(input);
    if (!findings.length) return text('No common written-Chinese forms found.');
    return text([`Found ${findings.length} written form${findings.length === 1 ? '' : 's'}:`, ...findings.map((f) => `- "${f.written}" in "…${f.context}…" → spoken: ${f.spoken}`)].join('\n'));
  });

  server.registerTool('get_practice_questions', {
    title: 'Get practice questions',
    description: 'Get practice questions with answers, to quiz a learner. Ask the questions first and only reveal the answers after the learner replies.',
    inputSchema: {
      type: z.enum(['fill_the_gap', 'build_the_sentence', 'spoken_or_written']).describe('Kind of exercise'),
      level: z.enum(LEVELS).optional().describe('Level, for fill_the_gap and build_the_sentence'),
      count: z.number().int().min(1).max(10).default(5).describe('Number of questions'),
    },
    annotations: READ_ONLY,
  }, async ({ type, level, count }) => {
    const items = practiceQuestions(data, type, { level, count });
    return text(['QUESTIONS', ...items.map((i) => i.question), '', 'ANSWERS (reveal only after the learner answers)', ...items.map((i) => i.answer)].join('\n'));
  });

  // --- Resources ------------------------------------------------------------

  server.registerResource('about', 'cantonlink://about', {
    title: 'About the CantonLink Community library',
    description: 'What the library contains, its licence and its review status',
    mimeType: 'text/markdown',
  }, async (uri) => {
    const all = [...data.grammar, ...data.vocabulary];
    const reviewed = all.filter((x) => x.review.status === 'reviewed').length;
    return {
      contents: [{
        uri: uri.href,
        mimeType: 'text/markdown',
        text: `# CantonLink Community library\n\nSpoken Hong Kong Cantonese, A1–B1: ${data.grammar.length} grammar patterns and ${data.vocabulary.reduce((n, t) => n + t.words.length, 0)} words in ${data.vocabulary.length} topics.\nJyutping is the source of truth; Yale and Bopomofo are generated from it.\nReviewed by native speakers: ${reviewed} of ${all.length} entries.\nLicence: ${data.licence}. Source: ${data.source}`,
      }],
    };
  });

  server.registerResource('grammar-pattern', new ResourceTemplate('cantonlink://grammar/{id}', {
    list: async () => ({ resources: data.grammar.map((p) => ({ uri: `cantonlink://grammar/${p.id}`, name: `${p.pattern} — ${p.meaning}`, mimeType: 'text/markdown' })) }),
    complete: { id: (value) => data.grammar.map((p) => p.id).filter((id) => id.startsWith(value)) },
  }), {
    title: 'Grammar pattern',
    description: 'One grammar pattern with examples and common mistakes',
    mimeType: 'text/markdown',
  }, async (uri, { id }) => {
    const pattern = findPattern(data, id);
    if (!pattern) throw new Error(`No grammar pattern with id "${id}"`);
    return { contents: [{ uri: uri.href, mimeType: 'text/markdown', text: formatPattern(pattern) }] };
  });

  server.registerResource('vocabulary-topic', new ResourceTemplate('cantonlink://vocabulary/{topic}', {
    list: async () => ({ resources: data.vocabulary.map((t) => ({ uri: `cantonlink://vocabulary/${t.id}`, name: `${t.title} (${t.words.length} words)`, mimeType: 'text/markdown' })) }),
    complete: { topic: (value) => data.vocabulary.map((t) => t.id).filter((id) => id.startsWith(value)) },
  }), {
    title: 'Vocabulary topic',
    description: 'All words in one topic, with romanisations and classifiers',
    mimeType: 'text/markdown',
  }, async (uri, { topic }) => {
    const t = data.vocabulary.find((x) => x.id === topic);
    if (!t) throw new Error(`No vocabulary topic "${topic}"`);
    return { contents: [{ uri: uri.href, mimeType: 'text/markdown', text: formatTopic(t) }] };
  });

  // --- Prompts --------------------------------------------------------------

  server.registerPrompt('cantonese_tutor', {
    title: 'Cantonese tutor',
    description: 'Start a short conversation lesson in spoken Hong Kong Cantonese, grounded in the library',
    argsSchema: {
      level: z.enum(LEVELS).describe('Learner level: A1, A2 or B1'),
      scenario: z.string().max(100).optional().describe('Situation to practise, e.g. "ordering at a cha chaan teng"'),
      romanisation: z.enum(['jyutping', 'yale']).optional().describe('Romanisation to show (default Jyutping)'),
    },
  }, ({ level, scenario, romanisation = 'jyutping' }) => ({
    messages: [{
      role: 'user',
      content: {
        type: 'text',
        text: [
          `Be my Cantonese tutor for a short ${level} conversation${scenario ? ` about ${scenario}` : ''}.`,
          '',
          'How to teach:',
          `- Use spoken Hong Kong Cantonese, not written Chinese. Write each line in characters with ${romanisation === 'yale' ? 'Yale' : 'Jyutping'} underneath and an English translation.`,
          `- Use list_grammar_patterns with level ${level} and get_grammar_pattern to choose two or three patterns to practise, and search_vocabulary for words.`,
          '- Before sending any Cantonese, run check_spoken_cantonese on it and fix anything it flags. Use romanise_jyutping if I ask for Yale or Bopomofo.',
          '- Keep each of your turns short, then let me answer. Gently correct my mistakes, naming the pattern involved.',
          '- If something you need is not in the library, say so rather than guessing.',
        ].join('\n'),
      },
    }],
  }));

  server.registerPrompt('explain_pattern', {
    title: 'Explain a grammar pattern',
    description: 'Explain one grammar pattern with the library examples, then quiz the learner on it',
    argsSchema: { id: z.string().describe('Pattern id, e.g. "zo2-completed"') },
  }, ({ id }) => ({
    messages: [{
      role: 'user',
      content: { type: 'text', text: `Use get_grammar_pattern with id "${id}". Explain the pattern simply in English, show the examples, point out the common mistake, then give me two short practice questions and wait for my answers.` },
    }],
  }));

  return server;
}

// Run over stdio when started directly (this is how desktop apps launch it).
// Never write to stdout here: it carries the protocol. Log to stderr instead.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const server = createServer();
  await server.connect(new StdioServerTransport());
  console.error('CantonLink Community MCP server running on stdio');
}
