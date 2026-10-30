import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createServer, displayOptions, loadLibrary } from '../server.mjs';
import { checkSpoken } from '../../tools/library.mjs';

const HAN = /\p{Script=Han}/u;
const clients = [];
let client; // characters on, for learners who read them

async function connect(display) {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await createServer(loadLibrary(), display).connect(serverTransport);
  const c = new Client({ name: 'test-client', version: '1.0.0' });
  await c.connect(clientTransport);
  clients.push(c);
  return c;
}

before(async () => {
  client = await connect({ characters: true, romanisation: 'jyutping' });
});

after(() => Promise.all(clients.map((c) => c.close())));

const callWith = async (c, name, args) => {
  const result = await c.callTool({ name, arguments: args });
  return { text: result.content.map((x) => x.text).join('\n'), isError: Boolean(result.isError) };
};
const call = (name, args) => callWith(client, name, args);

test('lists the six tools, all marked read-only', async () => {
  const { tools } = await client.listTools();
  assert.deepEqual(tools.map((t) => t.name).sort(), ['check_spoken_cantonese', 'get_grammar_pattern', 'get_practice_questions', 'list_grammar_patterns', 'romanise_jyutping', 'search_vocabulary']);
  for (const t of tools) {
    assert.ok(t.description.length > 40, `${t.name} needs a useful description`);
    assert.equal(t.annotations.readOnlyHint, true);
  }
});

test('search_vocabulary finds words by English, Jyutping and characters', async () => {
  for (const query of ['thank you', 'm4 goi1', 'm4goi', '唔該', 'mh goi', 'm goi']) {
    const { text } = await call('search_vocabulary', { query });
    assert.match(text, /唔該 — m4 goi1/, query);
  }
  assert.match((await call('search_vocabulary', { query: 'xyzzy' })).text, /No words/);
  assert.match((await call('search_vocabulary', { query: 'nei hoe' })).text, /^No exact match for "nei hoe"\. Closest matches/);
});

test('grammar tools list, fetch and suggest patterns', async () => {
  assert.equal((await call('list_grammar_patterns', { level: 'B1' })).text.split('\n').length, 19);
  const pattern = await call('get_grammar_pattern', { id: 'zo2-completed' });
  assert.match(pattern.text, /我食咗飯喇。/);
  assert.match(pattern.text, /Yale: ngóh sihk jó faahn la\./);
  const missing = await call('get_grammar_pattern', { id: 'zo2' });
  assert.equal(missing.isError, true);
  assert.match(missing.text, /Did you mean: zo2-completed/);
});

test('romanise_jyutping converts and validates', async () => {
  assert.match((await call('romanise_jyutping', { jyutping: 'nei5 hou2' })).text, /Yale: néih hóu\nBopomofo: ㄋㄝㄧ⁵ ㄏㄛㄨ²/);
  const bad = await call('romanise_jyutping', { jyutping: 'nei hou7' });
  assert.equal(bad.isError, true);
  assert.match(bad.text, /nei, hou7/);
});

test('check_spoken_cantonese flags written forms but not spoken words', async () => {
  const flagged = await call('check_spoken_cantonese', { text: '他是我的朋友。' });
  assert.match(flagged.text, /Found 3 written forms/);
  assert.match(flagged.text, /"他".*佢/);
  assert.match((await call('check_spoken_cantonese', { text: '佢係我朋友，搭的士嚟。其他人都唔知。' })).text, /No common written-Chinese forms/);
  assert.deepEqual(checkSpoken('對不起').map((f) => f.spoken), ['對唔住']);
});

test('get_practice_questions returns questions with answers held back', async () => {
  for (const type of ['fill_the_gap', 'build_the_sentence', 'spoken_or_written']) {
    const { text } = await call('get_practice_questions', { type, level: type === 'spoken_or_written' ? undefined : 'A1', count: 3 });
    const [questions, answers] = text.split('ANSWERS');
    assert.match(questions, /^QUESTIONS\n1\./);
    assert.match(answers, /\n3\. /);
  }
});

test('invalid arguments are rejected', async () => {
  const result = await client.callTool({ name: 'get_practice_questions', arguments: { type: 'essay' } });
  assert.equal(result.isError, true);
});

test('resources: about, grammar and vocabulary templates', async () => {
  const { resources } = await client.listResources();
  assert.ok(resources.some((r) => r.uri === 'cantonlink://about'));
  assert.ok(resources.some((r) => r.uri === 'cantonlink://grammar/hai6-copula'));
  assert.ok(resources.some((r) => r.uri === 'cantonlink://vocabulary/food-and-dim-sum'));
  const { contents } = await client.readResource({ uri: 'cantonlink://vocabulary/food-and-dim-sum' });
  assert.match(contents[0].text, /點心 — dim2 sam1/);
  const { completion } = await client.complete({ ref: { type: 'ref/resource', uri: 'cantonlink://grammar/{id}' }, argument: { name: 'id', value: 'gwo3' } });
  assert.deepEqual(completion.values.sort(), ['gwo3-comparison', 'gwo3-experience']);
});

test('prompts: tutor and explain_pattern', async () => {
  const { prompts } = await client.listPrompts();
  assert.deepEqual(prompts.map((p) => p.name).sort(), ['cantonese_tutor', 'explain_pattern']);
  const { messages } = await client.getPrompt({ name: 'cantonese_tutor', arguments: { level: 'A2', scenario: 'taking the MTR' } });
  assert.match(messages[0].content.text, /A2 conversation about taking the MTR/);
  assert.match(messages[0].content.text, /check_spoken_cantonese/);
});

test('runs over stdio as a desktop app would launch it', async () => {
  const child = spawn(process.execPath, [new URL('../server.mjs', import.meta.url).pathname], { stdio: ['pipe', 'pipe', 'pipe'] });
  const reply = new Promise((resolve) => child.stdout.once('data', (chunk) => resolve(JSON.parse(String(chunk).split('\n')[0]))));
  child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'stdio-test', version: '1' } } })}\n`);
  const message = await reply;
  child.kill();
  assert.equal(message.result.serverInfo.name, 'cantonlink-community');
  assert.ok(message.result.capabilities.tools && message.result.capabilities.resources && message.result.capabilities.prompts);
});

test('options come from arguments or the environment; characters are off by default', () => {
  assert.deepEqual(displayOptions([], {}), { characters: false, romanisation: 'jyutping' });
  assert.deepEqual(displayOptions(['--characters=on', '--romanisation=yale'], {}), { characters: true, romanisation: 'yale' });
  assert.deepEqual(displayOptions([], { CANTONLINK_CHARACTERS: 'ON', CANTONLINK_ROMANISATION: 'Yale' }), { characters: true, romanisation: 'yale' });
  assert.deepEqual(displayOptions(['--romanisation', 'yale'], { CANTONLINK_ROMANISATION: 'jyutping' }), { characters: false, romanisation: 'yale' });
  assert.throws(() => displayOptions(['--romanisation=bopomofo'], {}), /jyutping or yale/);
  assert.throws(() => displayOptions(['--characters=maybe'], {}), /on or off/);
});

// The site-wide rule, applied to the server: with characters off, nothing a
// learner can see contains Chinese characters. check_spoken_cantonese is the
// one exception: its input is the AI's own Cantonese in characters, which the
// AI checks before showing the learner only the romanisation.
for (const romanisation of ['jyutping', 'yale']) {
  test(`with characters off (${romanisation}), no characters in any tool, resource or prompt`, async () => {
    const c = await connect({ characters: false, romanisation });
    const seen = [];
    const { tools } = await c.listTools();
    seen.push(...tools.filter((t) => t.name !== 'check_spoken_cantonese').map((t) => `${t.name}: ${t.description}`));
    for (const query of ['thank you', 'm goi', 'lei hou', 'sihk', 'food', 'xyzzy']) seen.push((await callWith(c, 'search_vocabulary', { query, limit: 50 })).text);
    for (const level of ['A1', 'A2', 'B1', undefined]) {
      seen.push((await callWith(c, 'list_grammar_patterns', { level })).text);
      for (const type of ['fill_the_gap', 'build_the_sentence']) seen.push((await callWith(c, 'get_practice_questions', { type, level, count: 10 })).text);
    }
    const ids = (await callWith(c, 'list_grammar_patterns', {})).text.split('\n').map((line) => line.split(' ')[0]);
    for (const id of [...ids, 'zo2', 'jo']) seen.push((await callWith(c, 'get_grammar_pattern', { id })).text);
    seen.push((await callWith(c, 'romanise_jyutping', { jyutping: 'nei5 hou2' })).text);
    const spokenOrWritten = await callWith(c, 'get_practice_questions', { type: 'spoken_or_written' });
    assert.equal(spokenOrWritten.isError, true);
    seen.push(spokenOrWritten.text);

    const { resources } = await c.listResources();
    for (const r of resources) {
      seen.push(r.name);
      seen.push(...(await c.readResource({ uri: r.uri })).contents.map((x) => x.text));
    }
    const { prompts } = await c.listPrompts();
    for (const p of prompts) seen.push(p.description, ...(p.arguments ?? []).map((a) => a.description));
    for (const level of ['A1', 'B1']) seen.push((await c.getPrompt({ name: 'cantonese_tutor', arguments: { level } })).messages[0].content.text);
    for (const id of ids) seen.push((await c.getPrompt({ name: 'explain_pattern', arguments: { id } })).messages[0].content.text);
    seen.push(c.getInstructions());

    const leaks = seen.filter((text) => HAN.test(text ?? ''));
    assert.deepEqual(leaks, [], `characters shown with characters off:\n${leaks.slice(0, 3).join('\n---\n')}`);
  });
}

test('with characters off, Cantonese leads with the chosen romanisation and the tutor is told why', async () => {
  const yale = await connect({ characters: false, romanisation: 'yale' });
  assert.match((await callWith(yale, 'search_vocabulary', { query: 'm goi' })).text, /^m̀h gōi \| Jyutping: m4 goi1 — /);
  assert.match((await callWith(yale, 'get_grammar_pattern', { id: 'hai6-copula' })).text, /^# Subject \+ haih \+ Noun/);
  const tutor = (await yale.getPrompt({ name: 'cantonese_tutor', arguments: { level: 'A1' } })).messages[0].content.text;
  assert.match(tutor, /I do not read Chinese characters: write each line in Yale/);
  assert.match(tutor, /check_spoken_cantonese/);
  const jyutping = (await yale.getPrompt({ name: 'cantonese_tutor', arguments: { level: 'A1', romanisation: 'jyutping' } })).messages[0].content.text;
  assert.match(jyutping, /write each line in Jyutping/);
  assert.match(yale.getInstructions(), /does not read Chinese characters/);
  assert.doesNotMatch(client.getInstructions(), /does not read Chinese characters/);
});

test('the default server, as npx starts it, has characters off', async () => {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await createServer().connect(serverTransport);
  const c = new Client({ name: 'test-client', version: '1.0.0' });
  await c.connect(clientTransport);
  clients.push(c);
  assert.doesNotMatch((await callWith(c, 'search_vocabulary', { query: 'thank you' })).text, HAN);
});
