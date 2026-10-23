import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TOOLS, validateArguments, runTool } from './tool-definitions.mjs';

const data = JSON.parse(readFileSync(new URL('../dist/cantonlink-community.json', import.meta.url), 'utf8'));

test('six tools with schemas, descriptions and handlers', () => {
  assert.equal(TOOLS.length, 6);
  for (const t of TOOLS) {
    assert.match(t.name, /^[a-z_]+$/);
    assert.equal(t.inputSchema.type, 'object');
    assert.ok(t.description.length > 40);
    assert.equal(typeof t.run, 'function');
  }
});

test('validateArguments applies defaults and rejects bad input', () => {
  const schema = TOOLS.find((t) => t.name === 'search_vocabulary').inputSchema;
  assert.deepEqual(validateArguments(schema, { query: 'tea' }), { value: { query: 'tea', limit: 10 } });
  assert.deepEqual(validateArguments(schema, { query: 'tea', limit: '3' }), { value: { query: 'tea', limit: 3 } });
  assert.match(validateArguments(schema, {}).errors.join(), /"query" is required/);
  assert.match(validateArguments(schema, { query: 'tea', limit: 99 }).errors.join(), /at most 50/);
  assert.match(validateArguments(schema, null).errors.join(), /required/);
});

test('runTool runs a tool on the library and reports unknown tools', () => {
  assert.match(runTool(data, 'romanise_jyutping', { jyutping: 'nei5 hou2' }).text, /néih hóu/);
  assert.equal(runTool(data, 'romanise_jyutping', { jyutping: 'nei7' }).isError, true);
  assert.equal(runTool(data, 'get_practice_questions', { type: 'essay' }).isError, true);
  assert.match(runTool(data, 'delete_everything', {}).text, /Unknown tool/);
});
