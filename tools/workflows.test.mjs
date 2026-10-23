// Every CI job that runs the repository's npm scripts must install the
// dependencies first; the checks need devDependencies such as to-jyutping.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';

const dir = new URL('../.github/workflows/', import.meta.url);

test('jobs install dependencies before running npm scripts', () => {
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.yml'))) {
    const jobs = readFileSync(new URL(file, dir), 'utf8').split(/\n {2}(?=[\w-]+:\n)/).slice(1);
    for (const job of jobs) {
      const name = job.split(':')[0];
      const prefixed = /working-directory: mcp/.test(job);
      const runs = [...job.matchAll(/run: (.+)/g)].map((m) => m[1]);
      const installed = runs.findIndex((r) => /^npm ci\b/.test(r));
      runs.forEach((r, i) => {
        if (prefixed || !/^(npm (run|test)|node tests\/|node tools\/)/.test(r)) return;
        assert.ok(installed !== -1 && installed < i, `${file} job "${name}" runs "${r}" before npm ci`);
      });
    }
  }
});
