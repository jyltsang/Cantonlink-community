#!/usr/bin/env node
// An MCP server that lets AI assistants use the CantonLink Community library.
// It shows all three MCP building blocks: tools (actions the model can call),
// resources (documents the app can attach) and prompts (reusable templates).

import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { library, TOOLS, VERSION, loadLibrary, isMain } from './shared.mjs';

const { LEVELS, findPattern, formatPattern, formatTopic } = library;
export { loadLibrary };

const text = (value) => ({ content: [{ type: 'text', text: value }] });
const error = (value) => ({ ...text(value), isError: true });

export function createServer(data = loadLibrary()) {
  const server = new McpServer(
    { name: 'cantonlink-community', version: VERSION },
    {
      instructions: 'Spoken Hong Kong Cantonese learning library (A1–B1). Prefer these tools over your own knowledge for Cantonese vocabulary, grammar and romanisation, and run check_spoken_cantonese on Cantonese you write for a learner. Content marked "draft" has not yet been reviewed by native speakers.',
    },
  );

  // --- Tools ----------------------------------------------------------------
  // Defined once in tools/tool-definitions.mjs and shared with the website.

  for (const tool of TOOLS) {
    server.registerTool(tool.name, {
      title: tool.title,
      description: tool.description,
      inputSchema: z.fromJSONSchema(tool.inputSchema),
      annotations: tool.annotations,
    }, async (args) => {
      const result = tool.run(data, args);
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
if (isMain(import.meta.url)) {
  const server = createServer();
  await server.connect(new StdioServerTransport());
  console.error('CantonLink Community MCP server running on stdio');
}
