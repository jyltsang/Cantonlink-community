// Packs the npm package, unpacks it somewhere with no repository around it,
// and runs both commands through bin symlinks, as `npx` would.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, symlinkSync, mkdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const MCP = fileURLToPath(new URL('..', import.meta.url));
let dir;
let files;
const bin = (name) => join(dir, 'bin', name);

before(() => {
  dir = mkdtempSync(join(tmpdir(), 'cantonlink-pack-'));
  const [packed] = JSON.parse(execFileSync('npm', ['pack', '--json', '--pack-destination', dir], { cwd: MCP, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }));
  files = packed.files.map((f) => f.path);
  execFileSync('tar', ['-xzf', join(dir, packed.filename), '-C', dir]);
  symlinkSync(join(MCP, 'node_modules'), join(dir, 'package', 'node_modules'));
  mkdirSync(join(dir, 'bin'));
  symlinkSync(join(dir, 'package', 'cli.mjs'), bin('cantonlink'));
  symlinkSync(join(dir, 'package', 'server.mjs'), bin('cantonlink-mcp'));
});

after(() => rmSync(dir, { recursive: true, force: true }));

test('the package carries its own copies of the library and data, and nothing else', () => {
  for (const f of ['server.mjs', 'cli.mjs', 'shared.mjs', 'vendor/library.mjs', 'vendor/tool-definitions.mjs', 'vendor/romanise.mjs', 'vendor/cantonlink-community.json', 'vendor/LICENSE-CONTENT']) {
    assert.ok(files.includes(f), `${f} is missing from the package`);
  }
  assert.ok(!files.some((f) => f.startsWith('test/') || f.startsWith('scripts/')), 'tests and scripts are not published');
  assert.ok(!existsSync(join(MCP, 'vendor')), 'vendor/ is removed from the working copy after packing');
});

test('the CLI runs from the unpacked package', () => {
  const out = execFileSync(bin('cantonlink'), ['romanise', 'nei5 hou2'], { encoding: 'utf8' });
  assert.match(out, /Yale\s+néih hóu/);
  assert.match(execFileSync(bin('cantonlink'), ['word', 'write code'], { encoding: 'utf8' }), /寫 code — se2 code/);
});

test('the MCP server starts over stdio from the unpacked package', async () => {
  const client = new Client({ name: 'pack-test', version: '1.0.0' });
  await client.connect(new StdioClientTransport({ command: bin('cantonlink-mcp'), args: ['--romanisation=yale'], stderr: 'ignore' }));
  try {
    const { tools } = await client.listTools();
    assert.equal(tools.length, 6);
    const result = await client.callTool({ name: 'search_vocabulary', arguments: { query: 'deadline' } });
    assert.match(result.content[0].text, /^gón deadline \| Jyutping: gon2 deadline/, 'characters off by default; Yale from the argument');
  } finally {
    await client.close();
  }
});
