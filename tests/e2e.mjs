// End-to-end tests for the website, run in a real browser.
// Usage: npm run site && npm run test:e2e

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';

const PORT = 8123;
const BASE = `http://localhost:${PORT}/`;
const data = JSON.parse(readFileSync(new URL('../dist/cantonlink-community.json', import.meta.url), 'utf8'));
const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B50}\u{FE0F}]/u;

let server;
let browser;

before(async () => {
  server = spawn(process.execPath, ['tools/site.mjs', '--serve'], { env: { ...process.env, PORT: String(PORT) }, stdio: ['ignore', 'pipe', 'inherit'] });
  await new Promise((resolve, reject) => {
    server.stdout.on('data', (chunk) => { if (String(chunk).includes('Previewing')) resolve(); });
    server.on('exit', (code) => reject(new Error(`Server exited with ${code}`)));
  });
  browser = await chromium.launch();
});

after(async () => {
  await browser?.close();
  server?.kill();
});

async function open(path = '', { viewport = { width: 390, height: 844 }, colorScheme = 'light' } = {}) {
  const context = await browser.newContext({ viewport, colorScheme });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('fonts.g')) errors.push(m.text()); });
  await page.goto(BASE + path);
  await page.waitForSelector('main h1');
  return { page, context, errors };
}

const noOverflow = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

test('home page renders on phone and desktop, in light and dark mode', async () => {
  for (const [viewport, colorScheme] of [[{ width: 360, height: 740 }, 'light'], [{ width: 1280, height: 900 }, 'dark']]) {
    const { page, context, errors } = await open('', { viewport, colorScheme });
    assert.equal(await page.locator('h1').textContent(), '學廣東話 · Learn Cantonese');
    assert.equal(await page.locator('.mode-card').count(), 8);
    assert.ok(await noOverflow(page), 'page scrolls sideways');
    assert.doesNotMatch(await page.locator('body').innerText(), EMOJI);
    assert.deepEqual(errors, []);
    await context.close();
  }
});

test('every page renders without errors or sideways scrolling', async () => {
  const paths = ['#/grammar', `#/grammar/${data.grammar.at(-1).id}`, '#/vocabulary', `#/vocabulary/${data.vocabulary[0].id}`, '#/lookup',
    '#/flashcards', '#/fill-the-gap', '#/build', '#/tones', '#/spoken-or-written', '#/review', '#/nowhere'];
  const { page, context, errors } = await open();
  for (const path of paths) {
    await page.goto(BASE + path);
    await page.waitForSelector('main h1');
    assert.ok(await noOverflow(page), `${path} scrolls sideways`);
    assert.doesNotMatch(await page.locator('main').innerText(), EMOJI, `${path} contains emoji`);
    assert.doesNotMatch(await page.locator('main').innerText(), /\bnull\b|\bundefined\b|\[object/, `${path} shows a programming value`);
    const unnamed = await page.locator('button').evaluateAll((els) => els.filter((b) => !b.textContent.trim() && !b.getAttribute('aria-label')).length);
    assert.equal(unnamed, 0, `${path} has buttons without names`);
  }
  assert.deepEqual(errors, []);
  await context.close();
});

test('grammar: filter, read a pattern and practise it', async () => {
  const { page, context } = await open('#/grammar');
  await page.getByRole('button', { name: 'B1' }).click();
  const levels = await page.locator('.list-tags .tag:not(.tag-draft)').allTextContents();
  assert.ok(levels.length > 0 && levels.every((l) => l === 'B1'));

  const pattern = data.grammar.find((p) => p.id === 'zo2-completed');
  await page.goto(`${BASE}#/grammar/${pattern.id}`);
  assert.equal(await page.locator('.example').count(), pattern.examples.length);
  assert.ok(await page.locator('.mistake').count() >= 1);

  await page.getByRole('link', { name: 'Practise this pattern' }).click();
  const total = data.practice.fillGap.filter((q) => q.patternId === pattern.id).length;
  for (let i = 0; i < total; i++) {
    const en = (await page.locator('.prompt-en').textContent()).replace(/[“”]/g, '');
    const q = data.practice.fillGap.find((x) => x.patternId === pattern.id && x.en === en);
    await page.locator('.option', { hasText: q.options[0].jyutping }).first().click();
    assert.equal(await page.locator('.feedback strong').textContent(), 'Correct.');
    await page.locator('.next').click();
  }
  assert.equal(await page.locator('.score .big').textContent(), `${total} / ${total}`);
  await context.close();
});

test('build the sentence marks a correct answer as correct', async () => {
  const { page, context } = await open('#/build');
  const en = (await page.locator('.prompt-en').textContent()).replace(/[“”]/g, '');
  const q = data.practice.buildSentence.find((x) => x.en === en);
  for (const t of q.tokens.filter((x) => !x.punctuation)) {
    await page.locator('.tiles:not(.answer) .tile', { hasText: t.cjk }).first().click();
  }
  await page.getByRole('button', { name: 'Check' }).click();
  assert.equal(await page.locator('.feedback strong').textContent(), 'Correct.');
  await context.close();
});

test('look up finds words from English and converts Jyutping', async () => {
  const { page, context } = await open('#/lookup');
  await page.fill('#lookup-input', 'thank you');
  await page.waitForSelector('.word-row');
  assert.match(await page.locator('.words').innerText(), /唔該/);
  await page.fill('#lookup-input', 'nei5 hou2');
  const conversion = await page.locator('.convert').innerText();
  assert.match(conversion, /néih hóu/);
  assert.match(conversion, /ㄋㄝㄧ⁵ ㄏㄛㄨ²/);
  await context.close();
});

test('display settings change the romanisation and persist', async () => {
  const { page, context } = await open(`#/vocabulary/${data.vocabulary[0].id}`);
  await page.locator('.settings summary').click();
  await page.locator('input[value="yale"]').check();
  const first = data.vocabulary[0].words[0];
  assert.equal(await page.locator('.word-rom').first().textContent(), first.yale);
  await page.locator('input[value="bopomofo"]').check();
  assert.equal(await page.locator('.word-rom').first().textContent(), first.bopomofo);
  await page.locator('input[name="showCjk"]').uncheck();
  assert.equal(await page.locator('.word-han').count(), 0);
  await page.reload();
  await page.waitForSelector('.word-rom');
  assert.equal(await page.locator('.word-rom').first().textContent(), first.bopomofo);
  await context.close();
});

test('missed questions are saved, reviewed and cleared', async () => {
  const { page, context } = await open('#/flashcards');
  await page.locator('.card').click();
  await page.getByRole('button', { name: 'Again' }).click();
  assert.equal(await page.locator('#review-count').textContent(), ' (1)');

  await page.goto(`${BASE}#/review`);
  await page.locator('.card').waitFor();
  await page.getByRole('button', { name: 'Show meaning' }).click();
  await page.getByRole('button', { name: 'I knew it' }).click();
  await page.locator('.next').click();
  assert.equal(await page.locator('.score .big').textContent(), '1 / 1');
  await page.locator('.site-nav a', { hasText: 'Review' }).click();
  await page.waitForSelector('main h1');
  assert.match(await page.locator('main').innerText(), /Nothing to review/);
  assert.doesNotMatch(await page.locator('main').innerText(), /\bnull\b|undefined/);
  await context.close();
});

test('tones, spoken-or-written and flashcards complete a full session', async () => {
  const { page, context, errors } = await open('#/tones');
  for (const path of ['#/tones', '#/spoken-or-written']) {
    await page.goto(BASE + path);
    for (let i = 0; i < 10; i++) {
      await page.locator('.question .option').first().click();
      await page.locator('.next').click();
    }
    assert.match(await page.locator('.score .big').textContent(), /^\d+ \/ 10$/);
  }
  await page.goto(`${BASE}#/flashcards`);
  for (let i = 0; i < data.vocabulary[0].words.length; i++) {
    await page.keyboard.press('Space');
    await page.getByRole('button', { name: 'Got it' }).click();
  }
  assert.match(await page.locator('.score h2').textContent(), /done/);
  assert.deepEqual(errors, []);
  await context.close();
});

test('progress can be exported and imported', async () => {
  const { page, context } = await open('#/spoken-or-written');
  await page.locator('.question .option').first().click();
  await page.goto(BASE);
  await page.waitForSelector('.progress-panel');
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Export progress' }).click()]);
  const exported = JSON.parse(readFileSync(await download.path(), 'utf8'));
  assert.equal(exported.app, 'cantonlink-community');
  assert.equal(exported.progress.answered, 1);

  page.on('dialog', (d) => d.accept());
  await page.getByRole('button', { name: 'Reset' }).click();
  assert.match(await page.locator('.progress-panel').innerText(), /saved in this browser only/);
  await page.setInputFiles('#import-file', { name: 'progress.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(exported)) });
  await page.waitForFunction(() => document.querySelector('.progress-panel').innerText.includes('answered 1'));
  await context.close();
});

test('works offline after the first visit', async () => {
  const { page, context } = await open();
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await page.waitForSelector('.mode-card');
  await context.setOffline(true);
  await page.reload();
  await page.waitForSelector('.mode-card');
  await page.goto(`${BASE}#/grammar/hai6-copula`);
  await page.waitForSelector('.example');
  await context.close();
});
