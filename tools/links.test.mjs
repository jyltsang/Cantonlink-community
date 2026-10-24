// Every relative link in the Markdown documents must point at a file that
// exists, and at a heading that exists when it names one. Also checks that
// the three master documents are in place and link to each other, since the
// self-improvement loop starts from them.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SKIP = new Set(['node_modules', '.git', '_site', 'vendor']);

function markdownFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    if (SKIP.has(name)) return [];
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return markdownFiles(path);
    return name.endsWith('.md') ? [path] : [];
  });
}

// GitHub's heading anchors: lower case, punctuation removed, spaces to hyphens.
export const slug = (heading) => heading.trim().toLowerCase().replace(/[^\p{L}\p{N}\s_-]/gu, '').replace(/\s/g, '-');

const headings = new Map();
function anchorsOf(file) {
  if (!headings.has(file)) {
    const text = readFileSync(file, 'utf8').replace(/```[\s\S]*?```/g, '');
    const seen = new Map();
    const anchors = new Set();
    for (const [, heading] of text.matchAll(/^#{1,6}\s+(.+)$/gm)) {
      const base = slug(heading);
      const n = seen.get(base) ?? 0;
      anchors.add(n ? `${base}-${n}` : base);
      seen.set(base, n + 1);
    }
    headings.set(file, anchors);
  }
  return headings.get(file);
}

test('slugs follow GitHub', () => {
  assert.equal(slug('5. Live AI tutor test'), '5-live-ai-tutor-test');
  assert.equal(slug('The self-improvement loop'), 'the-self-improvement-loop');
  assert.equal(slug('Content quality — what "flawless" means'), 'content-quality--what-flawless-means');
});

test('every relative link in the documentation resolves', () => {
  const broken = [];
  for (const file of markdownFiles(ROOT)) {
    const text = readFileSync(file, 'utf8').replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]*`/g, '');
    for (const [, target] of text.matchAll(/\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) {
      if (/^(https?:|mailto:|data:)/.test(target)) continue;
      const [path, anchor] = target.split('#');
      const resolved = path ? join(dirname(file), decodeURIComponent(path)) : file;
      const where = `${relative(ROOT, file)} → ${target}`;
      if (!existsSync(resolved)) broken.push(`${where} (no such file)`);
      else if (anchor && resolved.endsWith('.md') && !anchorsOf(resolved).has(anchor)) broken.push(`${where} (no such heading)`);
    }
  }
  assert.deepEqual(broken, []);
});

test('the three master documents exist and link to each other', () => {
  const masters = ['DEVELOPED.md', 'MASTER_PLAN.md', 'NEXT_RUN.md'];
  for (const name of masters) {
    const text = readFileSync(join(ROOT, 'docs', name), 'utf8');
    for (const other of masters.filter((m) => m !== name)) assert.match(text, new RegExp(`\\]\\(${other.replace('.', '\\.')}`), `${name} links to ${other}`);
  }
  const claude = readFileSync(join(ROOT, 'CLAUDE.md'), 'utf8');
  for (const name of masters) assert.ok(claude.includes(`docs/${name}`), `CLAUDE.md points to ${name}`);
  assert.ok(existsSync(join(ROOT, '.claude/skills/next-run/SKILL.md')), 'the next-run skill exists');
});
