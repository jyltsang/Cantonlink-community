#!/usr/bin/env node
// An MCP server that lets AI assistants use the CantonLink Community library.
// It shows all three MCP building blocks: tools (actions the model can call),
// resources (documents the app can attach) and prompts (reusable templates).
//
// Options, as arguments in the app's MCP settings or as environment variables:
//   --characters=off|on            CANTONLINK_CHARACTERS    (default off)
//   --romanisation=jyutping|yale   CANTONLINK_ROMANISATION  (default jyutping)
// With characters off, as for learners who do not read them, no Chinese
// characters appear in tool results, resources or prompts.

import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { parseArgs } from 'node:util';
import { z } from 'zod';
import { library, TOOLS, VERSION, loadLibrary, isMain } from './shared.mjs';

const { LEVELS, findPattern, formatPattern, formatTopic, patternName } = library;
export { loadLibrary };

const text = (value) => ({ content: [{ type: 'text', text: value }] });
const error = (value) => ({ ...text(value), isError: true });

const SYSTEM_NAMES = { jyutping: 'Jyutping', yale: 'Yale' };

export function displayOptions(argv = process.argv.slice(2), env = process.env) {
  const { values } = parseArgs({ args: argv, options: { characters: { type: 'string' }, romanisation: { type: 'string' } }, strict: false });
  const characters = String(values.characters ?? env.CANTONLINK_CHARACTERS ?? 'off').toLowerCase();
  const romanisation = String(values.romanisation ?? env.CANTONLINK_ROMANISATION ?? 'jyutping').toLowerCase();
  if (!['on', 'off'].includes(characters)) throw new Error(`--characters must be on or off, not "${characters}"`);
  if (!SYSTEM_NAMES[romanisation]) throw new Error(`--romanisation must be jyutping or yale, not "${romanisation}"`);
  return { characters: characters === 'on', romanisation };
}

// What the AI is told about a learner who does not read characters.
const romanOnly = (system) => `The learner does not read Chinese characters. Write every Cantonese word and sentence in ${SYSTEM_NAMES[system]} with its tones, followed by an English translation, and never show Chinese characters, not even inside explanations.`;

export function createServer(data = loadLibrary(), display = { characters: false, romanisation: 'jyutping' }) {
  const server = new McpServer(
    { name: 'cantonlink-community', version: VERSION },
    {
      instructions: `Spoken Hong Kong Cantonese learning library (A1–B1). Prefer these tools over your own knowledge for Cantonese vocabulary, grammar and romanisation, and run check_spoken_cantonese on Cantonese you write for a learner. Content marked "draft" has not yet been reviewed by native speakers.${display.characters ? '' : ` ${romanOnly(display.romanisation)}`}`,
    },
  );

  // --- Tools ----------------------------------------------------------------
  // Defined once in tools/tool-definitions.mjs and shared with the website.

  for (const tool of TOOLS) {
    server.registerTool(tool.name, {
      title: tool.title,
      description: tool.name === 'check_spoken_cantonese' && !display.characters
        ? `${tool.description} The learner does not read characters: write your Cantonese in characters only to check it here, then show them the ${SYSTEM_NAMES[display.romanisation]}.`
        : tool.description,
      inputSchema: z.fromJSONSchema(tool.inputSchema),
      annotations: tool.annotations,
    }, async (args) => {
      const result = tool.run(data, args, display);
      return result.isError ? error(result.text) : text(result.text);
    });
  }

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
    list: async () => ({ resources: data.grammar.map((p) => ({ uri: `cantonlink://grammar/${p.id}`, name: `${patternName(p, display)} — ${p.meaning}`, mimeType: 'text/markdown' })) }),
    complete: { id: (value) => data.grammar.map((p) => p.id).filter((id) => id.startsWith(value)) },
  }), {
    title: 'Grammar pattern',
    description: 'One grammar pattern with examples and common mistakes',
    mimeType: 'text/markdown',
  }, async (uri, { id }) => {
    const pattern = findPattern(data, id);
    if (!pattern) throw new Error(`No grammar pattern with id "${id}"`);
    return { contents: [{ uri: uri.href, mimeType: 'text/markdown', text: formatPattern(pattern, display) }] };
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
    return { contents: [{ uri: uri.href, mimeType: 'text/markdown', text: formatTopic(t, display) }] };
  });

  // --- Prompts --------------------------------------------------------------

  server.registerPrompt('cantonese_tutor', {
    title: 'Cantonese tutor',
    description: 'Start a short conversation lesson in spoken Hong Kong Cantonese, grounded in the library',
    argsSchema: {
      level: z.enum(LEVELS).describe('Learner level: A1, A2 or B1'),
      scenario: z.string().max(100).optional().describe('Situation to practise, e.g. "ordering at a cha chaan teng"'),
      romanisation: z.enum(['jyutping', 'yale']).optional().describe(`Romanisation to show (default ${SYSTEM_NAMES[display.romanisation]})`),
    },
  }, ({ level, scenario, romanisation = display.romanisation }) => ({
    messages: [{
      role: 'user',
      content: {
        type: 'text',
        text: [
          `Be my Cantonese tutor for a short ${level} conversation${scenario ? ` about ${scenario}` : ''}.`,
          '',
          'How to teach:',
          ...(display.characters
            ? [
              `- Use spoken Hong Kong Cantonese, not written Chinese. Write each line in characters with ${SYSTEM_NAMES[romanisation]} underneath and an English translation.`,
              `- Use list_grammar_patterns with level ${level} and get_grammar_pattern to choose two or three patterns to practise, and search_vocabulary for words.`,
              '- Before sending any Cantonese, run check_spoken_cantonese on it and fix anything it flags. Use romanise_jyutping if I ask for Yale or Bopomofo.',
            ]
            : [
              `- Use spoken Hong Kong Cantonese, not written Chinese. I do not read Chinese characters: write each line in ${SYSTEM_NAMES[romanisation]} with its tones, then an English translation. Never show me characters, not even in explanations.`,
              `- Use list_grammar_patterns with level ${level} and get_grammar_pattern to choose two or three patterns to practise, and search_vocabulary for words. I may type romanisation without tones or with my own spelling; search_vocabulary accepts that.`,
              `- Before sending any Cantonese, write it in characters for yourself only, run check_spoken_cantonese on it and fix anything it flags; then show me only the ${SYSTEM_NAMES[romanisation]}. Use romanise_jyutping to turn Jyutping into Yale.`,
              '- When I answer, check my tones as well as my words, and show any correction in romanisation.',
            ]),
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
      content: { type: 'text', text: `Use get_grammar_pattern with id "${id}". Explain the pattern simply in English, show the examples, point out the common mistake, then give me two short practice questions and wait for my answers.${display.characters ? '' : ` I do not read Chinese characters: write all Cantonese in ${SYSTEM_NAMES[display.romanisation]} with its tones, never in characters.`}` },
    }],
  }));

  return server;
}

// Run over stdio when started directly (this is how desktop apps launch it).
// Never write to stdout here: it carries the protocol. Log to stderr instead.
if (isMain(import.meta.url)) {
  const server = createServer(loadLibrary(), displayOptions());
  await server.connect(new StdioServerTransport());
  console.error('CantonLink Community MCP server running on stdio');
}
