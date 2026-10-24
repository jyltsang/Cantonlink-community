import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildLexicon } from './library.mjs';
import { createClient, ProviderError } from './ai-providers.mjs';
import { checkedAnswer, tutorSystem, TASKS } from './ai-tutor.mjs';
import { TOOLS } from './tool-definitions.mjs';

const data = JSON.parse(readFileSync(new URL('../dist/cantonlink-community.json', import.meta.url), 'utf8'));
const lexicon = buildLexicon(data);

// A fake fetch that records requests and replies from a script.
function fakeFetch(responses) {
  const calls = [];
  const fn = async (url, init = {}) => {
    calls.push({ url, headers: init.headers ?? {}, body: init.body ? JSON.parse(init.body) : null });
    const next = responses.shift();
    return { ok: (next.status ?? 200) < 400, status: next.status ?? 200, statusText: 'x', headers: new Headers(next.headers ?? {}), json: async () => next.body };
  };
  fn.calls = calls;
  return fn;
}

const good = JSON.stringify({ reply: { words: [{ cjk: '你好', jyutping: 'nei5 hou2' }, { cjk: '！', jyutping: '' }], en: 'Hello!' }, correction: null, patterns: [], note: '' });
const bad = JSON.stringify({ reply: { words: [{ cjk: '你好', jyutping: 'nei7 hou2' }], en: 'Hello' }, correction: null, patterns: [], note: '' });

test('Claude adapter: headers, tools, tool results in one message, replayed turns', async () => {
  const fetch = fakeFetch([
    { body: { content: [{ type: 'thinking', thinking: '', signature: 's' }, { type: 'tool_use', id: 'tu1', name: 'search_vocabulary', input: { query: 'hello' } }, { type: 'tool_use', id: 'tu2', name: 'romanise_jyutping', input: { jyutping: 'nei5 hou2' } }], stop_reason: 'tool_use' } },
    { body: { content: [{ type: 'text', text: good }], stop_reason: 'end_turn' } },
  ]);
  const client = createClient({ provider: 'anthropic', apiKey: 'k', model: 'claude-opus-5-5', fetch });
  const history = [{ role: 'user', content: 'Hi' }];
  const result = await checkedAnswer({ client, system: 'S', history, kind: 'tutor', data, lexicon, tools: TOOLS });
  assert.equal(result.badge, 'verified');
  const [first, second] = fetch.calls;
  assert.equal(first.url, 'https://api.anthropic.com/v1/messages');
  assert.equal(first.headers['x-api-key'], 'k');
  assert.equal(first.headers['anthropic-version'], '2026-10-21');
  assert.equal(first.headers['anthropic-dangerous-direct-browser-access'], 'true');
  assert.equal(first.headers['anthropic-beta'], 'server-side-fallback-2026-07-01');
  assert.equal(first.body.fallbacks, 'default');
  assert.equal(first.body.output_config.effort, 'medium');
  assert.equal(first.body.output_config.format.type, 'json_schema');
  assert.equal(first.body.tools.length, 6);
  assert.ok(first.body.tools[0].input_schema);
  assert.equal(first.body.temperature, undefined);
  // the assistant turn is replayed exactly, thinking block included
  assert.equal(second.body.messages[1].content[0].type, 'thinking');
  // both tool results return in a single user message
  const results = second.body.messages[2].content;
  assert.deepEqual(results.map((r) => r.type), ['tool_result', 'tool_result']);
  assert.match(results[1].content, /néih hóu/);
});

test('Claude adapter reports refusals and rejected keys clearly', async () => {
  const refuse = createClient({ provider: 'anthropic', apiKey: 'k', model: 'claude-opus-5-5', fetch: fakeFetch([{ body: { content: [], stop_reason: 'refusal' } }]) });
  await assert.rejects(refuse.send({ system: 's', messages: [{ role: 'user', content: 'x' }] }), /declined/);
  const unauthorised = createClient({ provider: 'anthropic', apiKey: 'k', model: 'm', fetch: fakeFetch([{ status: 401, body: { error: { message: 'invalid x-api-key' } } }]) });
  await assert.rejects(unauthorised.send({ system: 's', messages: [{ role: 'user', content: 'x' }] }), /key was rejected/);
  assert.throws(() => createClient({ provider: 'anthropic', model: 'm' }), ProviderError);
});

test('OpenAI adapter: function tools, tool messages, strict JSON schema', async () => {
  const fetch = fakeFetch([
    { body: { choices: [{ message: { role: 'assistant', content: null, tool_calls: [{ id: 'c1', type: 'function', function: { name: 'get_grammar_pattern', arguments: '{"id":"zo2-completed"}' } }] }, finish_reason: 'tool_calls' }] } },
    { body: { choices: [{ message: { role: 'assistant', content: good }, finish_reason: 'stop' }] } },
  ]);
  const client = createClient({ provider: 'openai', apiKey: 'k', model: 'gpt-x', fetch });
  const events = [];
  const result = await checkedAnswer({ client, system: 'S', history: [{ role: 'user', content: 'Hi' }], kind: 'tutor', data, lexicon, tools: TOOLS, onEvent: (e) => events.push(e) });
  assert.equal(result.badge, 'verified');
  const [first, second] = fetch.calls;
  assert.equal(first.url, 'https://api.openai.com/v1/chat/completions');
  assert.equal(first.headers.authorization, 'Bearer k');
  assert.equal(first.body.messages[0].role, 'system');
  assert.equal(first.body.tools[0].type, 'function');
  assert.equal(first.body.response_format.json_schema.strict, true);
  assert.equal(second.body.messages.at(-1).role, 'tool');
  assert.equal(second.body.messages.at(-1).tool_call_id, 'c1');
  assert.match(second.body.messages.at(-1).content, /我食咗飯喇/);
  assert.ok(events.some((e) => e.type === 'tool' && e.name === 'get_grammar_pattern'));
});

test('OpenAI-compatible adapter uses the base URL, no key, and no response_format', async () => {
  const fetch = fakeFetch([{ body: { choices: [{ message: { role: 'assistant', content: good } }] } }, { body: { data: [{ id: 'llama' }] } }]);
  const client = createClient({ provider: 'compatible', model: 'llama', baseUrl: 'http://localhost:11434/v1/', fetch });
  await client.send({ system: 's', messages: [{ role: 'user', content: 'x' }], schema: {} });
  assert.equal(fetch.calls[0].url, 'http://localhost:11434/v1/chat/completions');
  assert.equal(fetch.calls[0].headers.authorization, undefined);
  assert.equal(fetch.calls[0].body.response_format, undefined);
  assert.deepEqual(await client.listModels(), ['llama']);
});

test('Gemini adapter: function declarations, function responses, key in header', async () => {
  const fetch = fakeFetch([
    { body: { candidates: [{ content: { role: 'model', parts: [{ functionCall: { name: 'list_grammar_patterns', args: { level: 'A1' } }, thoughtSignature: 'sig' }] } }] } },
    { body: { candidates: [{ content: { role: 'model', parts: [{ text: good }] }, finishReason: 'STOP' }] } },
  ]);
  const client = createClient({ provider: 'gemini', apiKey: 'g', model: 'gemini-x', fetch });
  const result = await checkedAnswer({ client, system: 'S', history: [{ role: 'user', content: 'Hi' }], kind: 'tutor', data, lexicon, tools: TOOLS });
  assert.equal(result.badge, 'verified');
  const [first, second] = fetch.calls;
  assert.match(first.url, /models\/gemini-x:generateContent$/);
  assert.equal(first.headers['x-goog-api-key'], 'g');
  assert.ok(!first.url.includes('key='));
  const decl = first.body.tools[0].functionDeclarations[0];
  assert.equal(decl.parameters.properties.query.minLength, undefined);
  assert.equal(second.body.contents[1].parts[0].thoughtSignature, 'sig');
  assert.ok(second.body.contents[2].parts[0].functionResponse);
});

test('a reply that fails checks is retried once and becomes Corrected', async () => {
  const fetch = fakeFetch([
    { body: { choices: [{ message: { role: 'assistant', content: bad } }] } },
    { body: { choices: [{ message: { role: 'assistant', content: good } }] } },
  ]);
  const client = createClient({ provider: 'openai', apiKey: 'k', model: 'm', fetch });
  const history = [{ role: 'user', content: 'Hi' }];
  const result = await checkedAnswer({ client, system: 'S', history, kind: 'tutor', data, lexicon });
  assert.equal(result.badge, 'corrected');
  assert.match(fetch.calls[1].body.messages.at(-1).content, /failed these checks: Valid Jyutping/);
  assert.ok(history.every((m, i) => i === 0 || m.hidden));
});

test('a reply that still fails after the retry is Unverified', async () => {
  const fetch = fakeFetch([
    { body: { choices: [{ message: { role: 'assistant', content: bad } }] } },
    { body: { choices: [{ message: { role: 'assistant', content: bad } }] } },
  ]);
  const client = createClient({ provider: 'openai', apiKey: 'k', model: 'm', fetch });
  const result = await checkedAnswer({ client, system: 'S', history: [{ role: 'user', content: 'Hi' }], kind: 'tutor', data, lexicon });
  assert.equal(result.badge, 'unverified');
  assert.equal(fetch.calls.length, 2);
});

test('the optional second opinion adds advice', async () => {
  const fetch = fakeFetch([
    { body: { choices: [{ message: { role: 'assistant', content: good } }] } },
    { body: { choices: [{ message: { role: 'assistant', content: '{"natural": false, "issues": ["Sounds abrupt without 呀."]}' } }] } },
  ]);
  const client = createClient({ provider: 'openai', apiKey: 'k', model: 'm', fetch });
  const result = await checkedAnswer({ client, system: 'S', history: [{ role: 'user', content: 'Hi' }], kind: 'tutor', data, lexicon, secondOpinionOn: true });
  const opinion = result.steps.find((s) => s.id === 'opinion');
  assert.equal(opinion.status, 'warn');
  assert.match(opinion.detail, /abrupt/);
  assert.equal(result.badge, 'verified');
});

test('prompts: tutor includes level patterns and rules; tasks build prompts', () => {
  const system = tutorSystem({ data, mode: 'sifu', level: 'B1', scenario: 'transport' });
  assert.match(system, /Sifu/);
  assert.match(system, /dou2-result/);
  assert.match(system, /MTR/);
  assert.match(system, /佢 not 他/);
  assert.equal(TASKS.translate('Good morning').kind, 'sentence');
  assert.match(TASKS.explain(data.grammar[0]).prompt, /Library examples/);
});

test('busy providers are retried, honouring Retry-After, then reported clearly', async () => {
  const waits = [];
  const sleep = async (ms) => { waits.push(ms); };
  const ok = { body: { candidates: [{ content: { parts: [{ text: good }] } }] } };
  const fetch = fakeFetch([{ status: 503, body: { error: { message: 'high demand' } } }, { status: 429, headers: { 'retry-after': '3' }, body: {} }, ok]);
  const client = createClient({ provider: 'gemini', apiKey: 'g', model: 'gemini-x', fetch, sleep });
  const reply = await client.send({ system: 's', messages: [{ role: 'user', content: 'hi' }], schema: null });
  assert.equal(reply.text, good);
  assert.deepEqual(waits, [2000, 3000]);

  const busy = fakeFetch([0, 1, 2].map(() => ({ status: 503, body: { error: { message: 'high demand' } } })));
  const failing = createClient({ provider: 'gemini', apiKey: 'g', model: 'gemini-x', fetch: busy, sleep });
  await assert.rejects(failing.send({ system: 's', messages: [{ role: 'user', content: 'hi' }] }), (e) => e instanceof ProviderError && /is busy \(503\), even after retrying/.test(e.message));
  assert.equal(busy.calls.length, 3);

  const invalid = fakeFetch([{ status: 400, body: { error: { message: 'bad request' } } }]);
  await assert.rejects(createClient({ provider: 'gemini', apiKey: 'g', model: 'gemini-x', fetch: invalid, sleep }).send({ system: 's', messages: [{ role: 'user', content: 'hi' }] }), /returned an error \(400\)/);
  assert.equal(invalid.calls.length, 1, 'a 400 is not retried');
});

test('a request that never answers times out with a clear error', async () => {
  const hanging = (url, init) => new Promise((_, reject) => init.signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError'))));
  const client = createClient({ provider: 'openai', apiKey: 'k', model: 'm', fetch: hanging, timeoutMs: 50 });
  await assert.rejects(client.send({ system: 's', messages: [{ role: 'user', content: 'hi' }] }), (e) => e instanceof ProviderError && /took too long to answer/.test(e.message));
});

test('a used-up quota is reported at once with when it resets, not retried', async () => {
  const waits = [];
  const quota = fakeFetch([{ status: 429, body: { error: { message: 'Quota exceeded', details: [{ '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay: '24468s' }] } } }]);
  const client = createClient({ provider: 'gemini', apiKey: 'g', model: 'gemini-x', fetch: quota, sleep: async (ms) => { waits.push(ms); } });
  await assert.rejects(client.send({ system: 's', messages: [{ role: 'user', content: 'hi' }] }), (e) => e instanceof ProviderError && /used up the quota.*resets in about 7 hours.*choose another model/s.test(e.message));
  assert.equal(quota.calls.length, 1);
  assert.deepEqual(waits, []);
});
