// End-to-end tests for the website, run in a real browser.
// Usage: npm run site && npm run test:e2e

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';
import { startMockAi } from './mock-ai.mjs';

const PORT = 8123;
const BASE = `http://localhost:${PORT}/`;
const data = JSON.parse(readFileSync(new URL('../dist/cantonlink-community.json', import.meta.url), 'utf8'));
const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B50}\u{FE0F}]/u;

let server;
let browser;
let mockAi;
const MOCK_PORT = 8125;

before(async () => {
  server = spawn(process.execPath, ['tools/site.mjs', '--serve'], { env: { ...process.env, PORT: String(PORT) }, stdio: ['ignore', 'pipe', 'inherit'] });
  await new Promise((resolve, reject) => {
    server.stdout.on('data', (chunk) => { if (String(chunk).includes('Previewing')) resolve(); });
    server.on('exit', (code) => reject(new Error(`Server exited with ${code}`)));
  });
  browser = await chromium.launch();
  mockAi = await startMockAi(MOCK_PORT);
});

after(async () => {
  await browser?.close();
  server?.kill();
  mockAi?.close();
});

async function open(path = '', { viewport = { width: 390, height: 844 }, colorScheme = 'light', storage } = {}) {
  const context = await browser.newContext({ viewport, colorScheme });
  // Seeds localStorage once, before the first page load.
  if (storage) await context.addInitScript((items) => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    for (const [key, value] of Object.entries(items)) localStorage.setItem(key, JSON.stringify(value));
  }, storage);
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
    assert.equal(await page.locator('.mode-card').count(), 9);
    assert.equal(await page.locator('.continue').count(), 1);
    assert.ok(await noOverflow(page), 'page scrolls sideways');
    assert.doesNotMatch(await page.locator('body').innerText(), EMOJI);
    assert.deepEqual(errors, []);
    await context.close();
  }
});

test('every page renders without errors or sideways scrolling', async () => {
  const paths = ['#/ai', '#/tutor', '#/grammar', `#/grammar/${data.grammar.at(-1).id}`, '#/vocabulary', `#/vocabulary/${data.vocabulary[0].id}`, '#/lookup',
    '#/flashcards', '#/fill-the-gap', '#/build', '#/tones', '#/spoken-or-written', '#/review', '#/path', '#/path/u12', '#/path/u03/practise', '#/path/u99', '#/nowhere'];
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
  assert.match(await page.locator('main').innerText(), /Nothing due right now\. 1 item is scheduled; the next is due on \w+day/);
  assert.doesNotMatch(await page.locator('main').innerText(), /\bnull\b|undefined/);
  assert.equal(await page.locator('#review-count').textContent(), '');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('cantonlink-progress')).review);
  const [entry] = Object.values(saved);
  assert.equal(entry.box, 2);
  assert.ok(Math.abs(entry.due - Date.now() - 86400000) < 60000, 'next review is a day later');
  await context.close();
});

test('review follows the spaced schedule and reads older saves', async () => {
  const DAY = 86400000;
  const now = Date.now();
  const { page, context, errors } = await open('#/', {
    storage: {
      'cantonlink-progress': {
        answered: 3, correct: 0,
        mistakes: { 'card:greetings:你好': now - DAY },
        review: {
          'card:greetings:早晨': { box: 5, due: now - 1000 },
          'card:greetings:多謝': { box: 3, due: now + 3 * DAY },
        },
      },
    },
  });
  assert.equal(await page.locator('#review-count').textContent(), ' (2)');
  assert.match(await page.locator('.due-line').innerText(), /2 items due now\. 3 in your review schedule\./);

  await page.goto(`${BASE}#/review`);
  for (let i = 0; i < 2; i++) {
    await page.locator('.card').waitFor();
    await page.getByRole('button', { name: 'Show meaning' }).click();
    await page.getByRole('button', { name: 'I knew it' }).click();
    await page.locator('.next').click();
  }
  assert.equal(await page.locator('.score .big').textContent(), '2 / 2');
  const review = await page.evaluate(() => JSON.parse(localStorage.getItem('cantonlink-progress')).review);
  assert.deepEqual(Object.keys(review).sort(), ['card:greetings:你好', 'card:greetings:多謝'], 'a box-5 item is learnt and leaves');
  assert.equal(review['card:greetings:你好'].box, 2);
  assert.equal(await page.locator('#review-count').textContent(), '');
  assert.deepEqual(errors, []);
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


test('code-mixed words work in the word list, the tone drill and flashcards', async () => {
  const { page, context, errors } = await open('#/vocabulary/tech-work');
  assert.match(await page.locator('main').innerText(), /mixes in English words/);
  await page.locator('text=寫 code').first().waitFor();
  for (const system of ['yale', 'bopomofo']) {
    await page.locator('.settings summary').click();
    await page.locator(`input[value=${system}]`).check();
    await page.locator('.settings summary').click();
    assert.match(await page.locator('main').innerText(), /\bcode\b[\s\S]*\bdeadline\b/);
  }
  await page.goto(`${BASE}#/tones`);
  await page.getByLabel('Topic').selectOption('tech-work');
  for (let i = 0; i < 10; i++) {
    await page.locator('.option').first().click();
    await page.locator('.next').click();
  }
  await page.locator('.score').waitFor();
  await page.goto(`${BASE}#/flashcards?topic=tech-work`);
  await page.locator('.card').waitFor();
  assert.deepEqual(errors, []);
  await context.close();
});

// --- Learning path ---------------------------------------------------------

function unitKeys(unitId) {
  const unit = data.path.find((u) => u.id === unitId);
  const has = (q) => unit.patterns.includes(q.patternId);
  return [
    ...data.practice.fillGap.filter(has).map((q) => `fill:${q.id}`),
    ...data.practice.buildSentence.filter(has).map((q) => `build:${q.id}`),
    ...data.vocabulary.filter((t) => unit.topics.includes(t.id)).flatMap((t) => t.words.map((w) => `card:${t.id}:${w.cjk}`)),
  ];
}

test('learning path: home card, units, progress and unit practice', async () => {
  const { page, context, errors } = await open('#/');
  assert.match(await page.locator('.continue').innerText(), /Start · Unit 1 of 12 · A1[\s\S]*Meeting people/);
  await page.getByRole('link', { name: 'Start the unit' }).click();
  await page.waitForSelector('main h1');
  assert.equal(await page.locator('main h1').textContent(), 'Unit 1: Meeting people');
  assert.equal(await page.locator('main .link-list').first().locator('li').count(), 5);

  await page.getByRole('link', { name: 'Practise this unit' }).click();
  await page.locator('main h1', { hasText: 'Practise: Meeting people' }).waitFor();
  assert.match(await page.locator('.progress').first().innerText(), /1 of 12/);

  await page.goto(`${BASE}#/path`);
  await page.waitForSelector('.path-unit');
  assert.equal(await page.locator('.path-unit').count(), 12);
  assert.equal(await page.locator('.path-unit.current h3').innerText().then((t) => t.startsWith('Meeting people')), true);
  assert.deepEqual(errors, []);
  await context.close();
});

test('learning path: a unit completes at 80% and the next one is up', async () => {
  const keys = unitKeys('u01');
  const done = Object.fromEntries(keys.slice(0, Math.ceil(keys.length * 0.8)).map((k) => [k, 1]));
  const { page, context, errors } = await open('#/', { storage: { 'cantonlink-progress': { answered: 50, correct: 50, done } } });
  assert.match(await page.locator('.continue').innerText(), /Start · Unit 2 of 12[\s\S]*Numbers and prices/);
  await page.goto(`${BASE}#/path`);
  await page.waitForSelector('.path-unit');
  const first = page.locator('.path-unit').first();
  assert.match(await first.innerText(), /Complete/);
  assert.equal(await first.locator('[role=progressbar]').getAttribute('aria-valuenow'), String(Math.round((Object.keys(done).length / keys.length) * 100)));
  assert.match(await page.locator('.path-unit.current').innerText(), /Numbers and prices/);
  assert.deepEqual(errors, []);
  await context.close();
});

// --- AI tutor (against the local mock provider) ----------------------------

async function connectMock(page, { remember = false } = {}) {
  await page.goto(`${BASE}#/ai`);
  await page.getByLabel('OpenAI-compatible').check();
  await page.fill('#ai-base', `http://localhost:${MOCK_PORT}/v1`);
  await page.fill('#ai-key', 'secret-key');
  await page.fill('#ai-model', 'mock-model');
  if (remember) await page.getByLabel('Remember the key on this device').check();
}

const lastTutor = (page) => page.locator('.msg-tutor:not(.pending)').last();

test('AI settings: connection test lists models; the key is forgotten on reload unless remembered', async () => {
  const { page, context } = await open('#/ai');
  await connectMock(page);
  await page.getByRole('button', { name: 'Test connection' }).click();
  await page.waitForFunction(() => document.querySelector('#ai-status').textContent.startsWith('Connected'));
  assert.equal(await page.locator('#model-list option').count(), 2);
  assert.equal(mockAi.requests.at(-1).auth, 'Bearer secret-key');
  await page.reload();
  await page.waitForSelector('#ai-key');
  assert.equal(await page.inputValue('#ai-key'), '');
  assert.equal(await page.inputValue('#ai-model'), 'mock-model');
  await connectMock(page, { remember: true });
  await page.reload();
  await page.waitForSelector('#ai-key');
  assert.equal(await page.inputValue('#ai-key'), 'secret-key');
  await page.getByRole('button', { name: 'Forget key' }).click();
  await page.reload();
  await page.waitForSelector('#ai-key');
  assert.equal(await page.inputValue('#ai-key'), '');
  await context.close();
});

test('AI tutor: a unit sets the level, scenario and focus patterns', async () => {
  const { page, context, errors } = await open('#/ai');
  await connectMock(page);
  await page.goto(`${BASE}#/path/u03`);
  await page.getByRole('link', { name: 'Practise with the AI tutor' }).click();
  await lastTutor(page).waitFor();
  assert.match(await page.locator('.unit-focus').innerText(), /Practising unit: Eating out/);
  assert.equal(await page.getByLabel('Scenario').inputValue(), 'restaurant');
  const system = mockAi.requests.filter((r) => r.path === '/v1/chat/completions').at(-1).body.messages[0].content;
  assert.match(system, /This lesson practises: soeng2-want/);
  assert.match(system, /cha chaan teng/);
  assert.deepEqual(errors, []);
  await context.close();
});

test('AI tutor: without a key it asks for one', async () => {
  const { page, context } = await open('#/tutor');
  assert.match(await page.locator('main').innerText(), /Add an API key/);
  await context.close();
});

test('AI tutor: every reply shows its checks, tool use and a badge; verified phrases can be saved', async () => {
  const { page, context, errors } = await open();
  const hosts = new Set();
  page.on('request', (r) => hosts.add(new URL(r.url()).host));
  await connectMock(page);
  await page.goto(`${BASE}#/tutor`);
  await lastTutor(page).locator('.badge').waitFor();
  assert.equal(await lastTutor(page).locator('.badge').textContent(), 'Verified');
  assert.match(await lastTutor(page).innerText(), /nei5 hou2/);
  assert.equal(await lastTutor(page).locator('.check').count(), 8);

  await page.fill('#chat-input', '我食咗飯喇');
  await page.keyboard.press('Enter');
  await page.locator('.activity', { hasText: 'get grammar pattern (zo2-completed)' }).waitFor();
  await page.waitForFunction(() => document.querySelectorAll('.msg-tutor:not(.pending) .badge').length === 2);
  const reply = lastTutor(page);
  assert.equal(await reply.locator('.badge').textContent(), 'Verified');
  assert.match(await reply.innerText(), /Grammar used: Verb \+ 咗, 乜嘢 \/ 咩/);
  assert.doesNotMatch(await reply.innerText(), /http/);
  await reply.getByRole('button', { name: 'Save phrase' }).click();
  assert.equal(await reply.getByRole('button', { name: 'Saved for review' }).isDisabled(), true);
  assert.equal(await page.locator('#review-count').textContent(), ' (1)');

  const tutorRequests = mockAi.requests.filter((r) => r.path === '/v1/chat/completions');
  assert.ok(tutorRequests.at(-1).body.tools.some((t) => t.function.name === 'search_vocabulary'));
  assert.equal(tutorRequests.at(-1).body.messages.at(-1).role, 'tool');
  for (const host of hosts) assert.ok([`localhost:${PORT}`, `localhost:${MOCK_PORT}`, 'fonts.googleapis.com', 'fonts.gstatic.com'].includes(host), `unexpected request to ${host}`);
  assert.deepEqual(errors, []);
  await context.close();
});

test('AI tutor: a failing reply is retried and Corrected; one that keeps failing is Unverified and cannot be saved', async () => {
  const { page, context } = await open();
  await connectMock(page);
  await page.goto(`${BASE}#/tutor`);
  await lastTutor(page).locator('.badge').waitFor();

  await page.fill('#chat-input', 'FIX please');
  await page.getByRole('button', { name: 'Send' }).click();
  await page.waitForFunction(() => document.querySelectorAll('.msg-tutor:not(.pending) .badge').length === 2);
  assert.equal(await lastTutor(page).locator('.badge').textContent(), 'Corrected');
  await lastTutor(page).locator('.checks summary').click();
  assert.match(await lastTutor(page).locator('.checks').innerText(), /retried once/);

  await page.fill('#chat-input', 'BAD please');
  await page.getByRole('button', { name: 'Send' }).click();
  await page.waitForFunction(() => document.querySelectorAll('.msg-tutor:not(.pending) .badge').length === 3);
  const unverified = lastTutor(page);
  assert.equal(await unverified.locator('.badge').textContent(), 'Unverified');
  await unverified.locator('.checks summary').click();
  assert.match(await unverified.locator('.check-fail').first().innerText(), /Valid Jyutping/);
  assert.equal(await unverified.getByRole('button', { name: 'Save phrase' }).isDisabled(), true);
  await context.close();
});

test('AI tutor: "Check my sentence" flags written Chinese and shows the correction', async () => {
  const { page, context } = await open();
  await connectMock(page);
  await page.goto(`${BASE}#/tutor`);
  await lastTutor(page).locator('.badge').waitFor();
  await page.getByRole('button', { name: 'Sifu (corrects you)' }).click();
  await page.fill('#chat-input', '他是學生');
  await page.getByRole('button', { name: 'Check my sentence' }).click();
  await page.locator('.learner-notes', { hasText: '"他" is written Chinese' }).waitFor();
  await page.waitForFunction(() => document.querySelectorAll('.msg-tutor:not(.pending) .badge').length === 2);
  const correction = lastTutor(page).locator('.correction');
  assert.match(await correction.innerText(), /佢/);
  assert.match(await correction.innerText(), /keoi5/);
  assert.equal(await correction.getByRole('link').textContent(), 'Subject + 係 + Noun');
  await context.close();
});

test('AI on other pages: translate in Look up and explain on a grammar page, both checked', async () => {
  const { page, context } = await open();
  await connectMock(page);
  await page.goto(`${BASE}#/lookup`);
  await page.fill('#lookup-input', 'good morning everyone');
  await page.getByRole('button', { name: /Translate .* with AI/ }).click();
  await page.locator('.ai-task .badge').waitFor();
  assert.match(await page.locator('.ai-task').innerText(), /zou2 san4/);
  await page.goto(`${BASE}#/grammar/zo2-completed`);
  await page.getByRole('button', { name: 'Explain with more examples' }).click();
  await page.locator('.ai-task .badge').waitFor();
  assert.equal(await page.locator('.ai-task .badge').textContent(), 'Verified');
  await context.close();
});
