// The AI tutor's engine: prompts, the tool loop, and the check-and-retry step.
// It works with any client from ai-providers.mjs and has no UI, so the same
// logic is tested in Node and used by the website.

import { TOOLS, runTool } from './tool-definitions.mjs';
import { verify, badgeFor, SCHEMAS } from './ai-checks.mjs';
import { listPatterns, findPattern } from './library.mjs';

export const SCENARIOS = {
  free: 'free conversation about everyday life',
  restaurant: 'ordering food and drink at a cha chaan teng (Hong Kong café)',
  shopping: 'shopping at a market or in a shop, asking prices',
  transport: 'getting around by MTR, bus, minibus and taxi',
  directions: 'asking for and giving directions',
  doctor: 'seeing a doctor and describing symptoms',
  work: 'small talk with colleagues at work',
  friends: 'meeting someone new and making friends',
};

const JSON_RULES = `Always answer with one JSON object and nothing else, in this shape:
{"reply": {"words": [{"cjk": "你好", "jyutping": "nei5 hou2"}, {"cjk": "！", "jyutping": ""}], "en": "Hello!"},
 "correction": null,
 "patterns": ["pattern-id"],
 "note": ""}
- "words": the Cantonese reply split into words. Each word has Hong Kong Traditional characters and Jyutping with tone numbers 1–6, one syllable per character. Punctuation is its own word with empty Jyutping.
- "en": a natural English translation.
- "correction": null, or {"learner_said": "...", "better": {"words": [...], "en": "..."}, "explanation": "short English explanation", "pattern_id": "pattern-id or null"} when the learner's last message had a mistake.
- "patterns": ids of library grammar patterns your reply uses (from list_grammar_patterns). Never invent ids.
- "note": optional short English tip, or "".`;

// For learners who have turned characters off: the reply itself is shown in
// romanisation word by word, but free English text would otherwise mention
// Cantonese words in characters.
const ROMAN_ONLY = 'The learner does not read Chinese characters. In "explanation", "note" and any other English text, write Cantonese words in Jyutping only (for example "zo2", not "咗").';

export function tutorSystem({ data, mode = 'friend', level = 'A1', scenario = 'free', focus = [], dialogue = null, romanOnly = false }) {
  const patterns = listPatterns(data, level).map((p) => `${p.id}: ${p.pattern} (${p.meaning})`).join('\n');
  const style = mode === 'sifu'
    ? 'You are a patient Cantonese teacher (師傅, Sifu). Correct every mistake the learner makes, gently, and name the grammar pattern involved.'
    : 'You are a friendly Hong Kong local chatting with a learner. Keep the conversation flowing; only correct mistakes that would confuse a listener.';
  const focusPatterns = focus.map((id) => findPattern(data, id)).filter(Boolean);
  const focusNote = focusPatterns.length
    ? `\nThis lesson practises: ${focusPatterns.map((p) => `${p.id}: ${p.pattern} (${p.meaning})`).join('; ')}. Use these patterns naturally and steer the conversation so the learner needs them.\n`
    : '';
  const dialogueNote = dialogue
    ? `\nRole-play the situation of this model dialogue, "${dialogue.title}". You are ${dialogue.speakers.A} and the learner is ${dialogue.speakers.B}. Start as ${dialogue.speakers.A} does, then let the conversation develop naturally rather than repeating the script:\n${dialogue.lines.map((line) => `${dialogue.speakers[line.speaker]}: ${line.cjk} (${line.en})`).join('\n')}\n`
    : '';
  return `${style}

Speak natural spoken Hong Kong Cantonese, never Standard Written Chinese: say 佢 not 他, 係 not 是, 嘅 not 的, 唔 not 不, 咗 not 了, 喺 not 在.
The learner is at level ${level}. Keep each reply to one or two short sentences at that level, and usually end with a simple question so they can answer.
Scenario: ${SCENARIOS[scenario] ?? SCENARIOS.free}.
Use the tools to look up words and grammar in the learner's reviewed library rather than relying on memory, especially for Jyutping. The learner may write in characters, Jyutping or English.

Grammar patterns at this level:
${patterns}
${focusNote}${dialogueNote}
${JSON_RULES}${romanOnly ? `\n${ROMAN_ONLY}` : ''}`;
}

const TASK_SYSTEM = `You help learners of spoken Hong Kong Cantonese. Use natural spoken Cantonese, never Standard Written Chinese (佢 not 他, 係 not 是, 嘅 not 的, 唔 not 不, 咗 not 了). Jyutping must have tone numbers 1–6, one syllable per character. Answer with one JSON object and nothing else.`;

export const TASKS = {
  translate: (english) => ({
    kind: 'sentence',
    prompt: `Translate into natural spoken Hong Kong Cantonese: "${english}"\nAnswer as {"words": [{"cjk": "...", "jyutping": "..."}], "en": "the English"}, with punctuation as its own word with empty Jyutping.`,
  }),
  explain: (pattern, { romanOnly = false } = {}) => ({
    kind: 'explain',
    prompt: `Explain this Cantonese grammar pattern to a learner in simple English (at most 120 words), then give two new example sentences that are different from the library's.
Pattern: ${pattern.pattern} — ${pattern.meaning}
Library explanation: ${pattern.explanation}
Library examples: ${pattern.examples.map((e) => `${e.cjk} (${e.jyutping}) "${e.en}"`).join('; ')}
Answer as {"explanation": "...", "examples": [{"words": [{"cjk": "...", "jyutping": "..."}], "en": "..."}]}.${romanOnly ? `\n${ROMAN_ONLY}` : ''}`,
  }),
};

const MAX_TOOL_ROUNDS = 5;

// Send the conversation, running any tools the model asks for, until it gives
// a final answer. Appends every message to `history`.
async function runTurn({ client, system, history, tools, schema, data, onEvent }) {
  for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
    const response = await client.send({ system, messages: history, tools: round < MAX_TOOL_ROUNDS ? tools : [], schema });
    history.push({ role: 'assistant', content: response.text, toolCalls: response.toolCalls, native: response.native, hidden: true });
    if (!response.toolCalls.length) return response.text;
    for (const call of response.toolCalls) {
      const result = call.args?.__invalid !== undefined
        ? { text: 'The tool arguments were not valid JSON. Try again.', isError: true }
        : runTool(data, call.name, call.args);
      onEvent?.({ type: 'tool', name: call.name, args: call.args, isError: result.isError });
      history.push({ role: 'tool', id: call.id, name: call.name, content: result.text, isError: result.isError, hidden: true });
    }
  }
  return '';
}

async function secondOpinion({ client, value, kind }) {
  const sentences = kind === 'tutor' ? [value.reply, value.correction?.better].filter(Boolean) : kind === 'explain' ? value.examples : [value];
  const text = sentences.map((s) => `${s.cjk} (${s.jyutping}) "${s.en}"`).join('\n');
  const response = await client.send({
    system: `You review Cantonese written for learners. Judge whether each sentence is natural spoken Hong Kong Cantonese, with correct Jyutping tones and an accurate English translation. Answer with one JSON object and nothing else: {"natural": true or false, "issues": ["short description of each problem"]}.`,
    messages: [{ role: 'user', content: text }],
    schema: { type: 'object', additionalProperties: false, required: ['natural', 'issues'], properties: { natural: { type: 'boolean' }, issues: { type: 'array', items: { type: 'string' } } } },
  });
  const start = response.text.indexOf('{');
  const parsed = JSON.parse(response.text.slice(start, response.text.lastIndexOf('}') + 1));
  return parsed;
}

// One checked AI answer. The steps are reported as they run, failures are
// fed back for one retry, and the result carries a badge.
export async function checkedAnswer({ client, system, history, kind, data, lexicon, tools = [], secondOpinionOn = false, onEvent }) {
  const schema = SCHEMAS[kind];
  onEvent?.({ type: 'stage', stage: 'thinking' });
  let text = await runTurn({ client, system, history, tools, schema, data, onEvent });
  onEvent?.({ type: 'stage', stage: 'checking' });
  let result = verify(kind, text, { data, lexicon });
  onEvent?.({ type: 'checks', steps: result.steps, attempt: 1 });
  let retried = false;
  if (result.retryFeedback) {
    retried = true;
    onEvent?.({ type: 'stage', stage: 'retrying', reason: result.retryFeedback });
    history.push({ role: 'user', hidden: true, content: `Your last answer failed these checks: ${result.retryFeedback} Answer again with corrected JSON only, keeping the same meaning.` });
    text = await runTurn({ client, system, history, tools, schema, data, onEvent });
    result = verify(kind, text, { data, lexicon });
    onEvent?.({ type: 'checks', steps: result.steps, attempt: 2 });
  }
  const steps = result.steps.map((s) => ({ ...s }));
  if (retried) {
    const structure = steps.find((s) => s.id === 'structure');
    structure.detail = `${structure.detail} (first answer failed checks and was retried once)`.trim();
  }
  if (secondOpinionOn && result.value) {
    const opinion = steps.find((s) => s.id === 'opinion');
    onEvent?.({ type: 'stage', stage: 'opinion' });
    try {
      const review = await secondOpinion({ client, value: result.value, kind });
      Object.assign(opinion, review.natural && !review.issues?.length
        ? { status: 'pass', detail: 'A second review found no problems.' }
        : { status: 'warn', detail: `Advice from a second review: ${(review.issues ?? []).join(' ') || 'it may not sound natural.'}` });
    } catch {
      Object.assign(opinion, { status: 'skip', detail: 'The second review could not be completed.' });
    }
  }
  const badge = badgeFor(result, { retried });
  onEvent?.({ type: 'checks', steps, attempt: retried ? 2 : 1, done: true, badge });
  return { value: result.value, steps, badge, raw: text };
}
