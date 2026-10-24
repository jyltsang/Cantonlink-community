// WCAG AA contrast for the colour pairs the site uses, in both themes. The
// tokens are read from site/styles.css, so a palette change that hurts
// legibility fails here rather than in a learner's eyes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../site/styles.css', import.meta.url), 'utf8');

function declarations(block) {
  const out = {};
  for (const [, name, value] of block.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) out[name] = value.trim();
  return out;
}
const light = declarations(css.match(/:root\s*\{([\s\S]*?)\n\}/)[1]);
const dark = { ...light, ...declarations(css.match(/@media \(prefers-color-scheme: dark\)\s*\{\s*:root\s*\{([\s\S]*?)\n {2}\}/)[1]) };

function resolve(theme, name, depth = 0) {
  const value = theme[name];
  assert.ok(value, `${name} is not defined`);
  assert.ok(depth < 10, `${name} refers to itself`);
  const ref = value.match(/^var\((--[\w-]+)\)$/);
  return ref ? resolve(theme, ref[1], depth + 1) : value;
}

function luminance(hex) {
  const m = hex.match(/^#([0-9a-f]{6})$/i);
  assert.ok(m, `expected a #rrggbb colour, got ${hex}`);
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export function ratio(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const TEXT = 4.5;
const UI = 3;
const PAIRS = [
  // Body text on every surface
  ...['--fg-1', '--fg-2', '--fg-3'].flatMap((fg) => ['--bg-canvas', '--paper', '--bg-subtle'].map((bg) => [fg, bg, TEXT])),
  ['--fg-2', '--bg-muted', TEXT],
  ['--fg-inverse', '--ink', TEXT],          // primary buttons, learner bubbles, selected chips
  ['--link', '--bg-canvas', TEXT],
  ['--link', '--paper', TEXT],
  ['--accent', '--bg-canvas', TEXT],        // eyebrows, highlighted and blank words
  ['--accent', '--paper', TEXT],
  ['--tone', '--paper', TEXT],              // Jyutping tone superscripts
  ['--tone', '--bg-subtle', TEXT],
  ['--success-fg', '--success-bg', TEXT],
  ['--danger-fg', '--danger-bg', TEXT],
  ['--warning-fg', '--warning-bg', TEXT],
  ['--reveal-fg', '--reveal-bg', TEXT],     // corrections and Try first reveals
  ['--fg-1', '--danger-bg', TEXT],          // mistakes, error messages
  ['--fg-1', '--warning-bg', TEXT],         // notices
  ['--success-fg', '--paper', TEXT],        // check statuses
  ['--danger-fg', '--paper', TEXT],
  ['--warning-fg', '--paper', TEXT],
  // Non-text UI
  ['--border-input', '--paper', UI],
  ['--border-input', '--bg-canvas', UI],
  ['--focus-ring', '--bg-canvas', UI],
  ['--focus-ring', '--paper', UI],
  ['--success-fill', '--bg-muted', UI],     // progress bars
  ['--ink', '--bg-canvas', UI],             // selected states, hover outlines
];

for (const [name, theme] of [['light', light], ['dark', dark]]) {
  test(`${name} theme meets WCAG AA for every colour pair the site uses`, () => {
    const failures = PAIRS
      .map(([fg, bg, min]) => ({ fg, bg, min, value: ratio(resolve(theme, fg), resolve(theme, bg)) }))
      .filter((p) => p.value < p.min)
      .map((p) => `${p.fg} on ${p.bg}: ${p.value.toFixed(2)}:1, needs ${p.min}:1`);
    assert.deepEqual(failures, []);
  });
}

test('the contrast check itself is right', () => {
  assert.equal(ratio('#000000', '#ffffff').toFixed(1), '21.0');
  assert.equal(ratio('#777777', '#ffffff').toFixed(2), '4.48');
});

test('the site uses only roles that both themes define', () => {
  const used = new Set([...css.matchAll(/var\((--[\w-]+)\)/g)].map((m) => m[1]));
  const missing = [...used].filter((v) => !(v in light));
  assert.deepEqual(missing, []);
});
