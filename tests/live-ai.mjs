// Drives the real AI tutor in a browser against real providers, using keys
// from the environment, and reports how every reply fared in the checks.
//
//   ANTHROPIC_API_KEY=… OPENAI_API_KEY=… GEMINI_API_KEY=… node tests/live-ai.mjs [--local]
//
// Providers without a key are skipped. By default it tests the deployed site
// (its real Content-Security-Policy and code); --local builds and serves
// _site/ instead. Optional: ANTHROPIC_MODEL, OPENAI_MODEL, GEMINI_MODEL.
// --mock answers the OpenAI calls from the scripted provider in
// tests/mock-ai.mjs, which tests this script itself without a key.
// Exits with 1 if any tested provider misses the pass criteria below.

import { spawn } from 'node:child_process';
import { appendFileSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';
import { startMockAi } from './mock-ai.mjs';

const MOCK = process.argv.includes('--mock');
const MOCK_PORT = 8791;
const LOCAL = process.argv.includes('--local');
const BASE = LOCAL ? 'http://localhost:8080/' : (process.env.SITE_URL ?? 'https://jyltsang.github.io/Cantonlink-community/');
const REPLY_TIMEOUT = 240_000;
// Pause between steps so free-tier keys (often 15 requests a minute) are not
// rate-limited by the test itself; one tutor reply can take several requests.
const STEP_PAUSE = Number(process.env.STEP_PAUSE_MS ?? (process.argv.includes('--mock') ? 0 : 20_000));
const PROVIDERS = [
  { id: 'anthropic', name: 'Claude', key: 'ANTHROPIC_API_KEY', model: 'ANTHROPIC_MODEL', hosts: ['api.anthropic.com'] },
  { id: 'openai', name: 'OpenAI', key: 'OPENAI_API_KEY', model: 'OPENAI_MODEL', hosts: ['api.openai.com'] },
  { id: 'gemini', name: 'Gemini', key: 'GEMINI_API_KEY', model: 'GEMINI_MODEL', hosts: ['generativelanguage.googleapis.com'] },
];
// Pass criteria for each provider.
const MIN_GOOD_SHARE = 0.8; // Verified or Corrected

const tutorReplies = '.msg-tutor:not(.pending), .msg-error';

async function readReply(locator) {
  if (await locator.evaluate((el) => el.classList.contains('msg-error'))) {
    return { badge: 'error', error: (await locator.innerText()).split('\n')[0] };
  }
  const badge = (await locator.locator('.badge').first().textContent()).trim().toLowerCase();
  const checks = await locator.locator('.check').evaluateAll((items) => items.map((li) => ({
    status: [...li.classList].find((c) => c.startsWith('check-'))?.slice(6),
    label: li.querySelector('.check-label')?.textContent ?? '',
    detail: li.querySelector('.check-detail')?.textContent ?? '',
  })));
  const save = locator.getByRole('button', { name: /Save phrase|Saved for review/ });
  const saveDisabled = (await save.count()) ? await save.first().isDisabled() : null;
  const text = (await locator.locator('.sentence, .en').allInnerTexts()).join(' ').replace(/\s+/g, ' ').slice(0, 160);
  return { badge, checks, saveDisabled, hasCorrection: (await locator.locator('.correction').count()) > 0, text };
}

async function waitForNthReply(page, n) {
  await page.waitForFunction(([selector, count]) => document.querySelectorAll(selector).length >= count, [tutorReplies, n], { timeout: REPLY_TIMEOUT });
  return page.locator(tutorReplies).nth(n - 1);
}

async function runTask(page, url, setup, label) {
  await page.goto(BASE + url);
  await page.waitForSelector('main h1');
  await setup();
  await page.getByRole('button', { name: label }).click();
  const out = page.locator('.ai-task');
  await out.locator('.badge, [role=alert]').first().waitFor({ timeout: REPLY_TIMEOUT });
  if (await out.locator('[role=alert]').count()) return { badge: 'error', error: await out.locator('[role=alert]').innerText() };
  return readReply(out);
}

async function testProvider(browser, provider) {
  const result = { provider: provider.name, steps: [], networkErrors: [], connection: '' };
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  if (MOCK) {
    await context.route('https://api.openai.com/v1/**', async (route) => {
      const response = await route.fetch({ url: route.request().url().replace('https://api.openai.com', `http://localhost:${MOCK_PORT}`) });
      await route.fulfill({ response, headers: { ...response.headers(), 'access-control-allow-origin': '*' } });
    });
  }
  const page = await context.newPage();
  const isProvider = (url) => provider.hosts.includes(new URL(url).host);
  page.on('requestfailed', (r) => { if (isProvider(r.url())) result.networkErrors.push(`${r.method()} ${new URL(r.url()).pathname}: ${r.failure()?.errorText}`); });
  page.on('response', (r) => { if (isProvider(r.url()) && r.status() >= 400) result.networkErrors.push(`${r.request().method()} ${new URL(r.url()).pathname}: HTTP ${r.status()}`); });
  page.on('console', (m) => { if (m.type() === 'error' && /CORS|Content Security Policy/i.test(m.text())) result.networkErrors.push(m.text().slice(0, 200)); });

  const step = async (name, fn) => {
    if (result.steps.length) await new Promise((resolve) => setTimeout(resolve, STEP_PAUSE));
    const started = Date.now();
    try {
      const reply = await fn();
      result.steps.push({ name, seconds: Math.round((Date.now() - started) / 100) / 10, ...reply });
    } catch (error) {
      result.steps.push({ name, seconds: Math.round((Date.now() - started) / 100) / 10, badge: 'error', error: error.message.split('\n')[0] });
    }
  };

  // 1. Settings and connection test. The key is kept in memory only, so a
  // reload (used to recover from a failed step) means entering it again.
  const connect = async () => {
    await page.goto(`${BASE}#/ai`);
    await page.reload();
    await page.locator(`input[name=provider][value=${provider.id}]`).check();
    await page.fill('#ai-key', process.env[provider.key]);
    if (process.env[provider.model]) await page.fill('#ai-model', process.env[provider.model]);
    await page.getByRole('button', { name: 'Test connection' }).click();
    await page.waitForFunction(() => !/Testing/.test(document.getElementById('ai-status').textContent), null, { timeout: 60_000 });
  };
  await connect();
  result.connection = await page.locator('#ai-status').textContent();
  result.model = await page.inputValue('#ai-model');
  result.models = await page.locator('#model-list option').evaluateAll((options) => options.map((o) => o.value));

  // 2–3. A conversation with the Friend tutor, then a Sifu correction. After
  // a failed turn the chat starts again, so one failure does not spoil the rest.
  let replies = 0;
  const startChat = async () => {
    await page.goto(`${BASE}#/tutor`);
    replies = 0;
    return readReply(await waitForNthReply(page, ++replies));
  };
  const say = async (message, button = 'Send') => {
    await page.fill('#chat-input', message);
    await page.getByRole('button', { name: button }).click();
    return readReply(await waitForNthReply(page, ++replies));
  };
  const chatStep = async (name, fn) => {
    const before = result.steps.length;
    await step(name, fn);
    if (result.steps[before]?.badge === 'error') {
      await connect();
      await startChat().catch(() => {});
    }
  };
  await chatStep('Friend: opening', startChat);
  await chatStep('Friend: "我今日好攰，啱啱收工。"', () => say('我今日好攰，啱啱收工。'));
  await chatStep('Friend: "Can you suggest somewhere to eat dinner nearby?"', () => say('Can you suggest somewhere to eat dinner nearby?'));
  await chatStep('Sifu: check 他是學生', async () => {
    await page.getByRole('button', { name: 'Sifu (corrects you)' }).click();
    return say('他是學生', 'Check my sentence');
  });

  // 4–5. AI tasks on other pages
  await step('Look up: translate', () => runTask(page, '#/lookup', () => page.fill('#lookup-input', "I'm running late for the meeting"), /Translate .* with AI/));
  await step('Grammar: explain 過', () => runTask(page, '#/grammar/gwo3-experience', async () => {}, 'Explain with more examples'));

  // 6. A unit role-play
  await step('Unit 3: role-play', async () => {
    await page.goto(`${BASE}#/path/u03`);
    await page.getByRole('link', { name: /AI tutor/ }).first().click();
    return readReply(await waitForNthReply(page, 1));
  });

  await context.close();
  return judge(result);
}

function judge(result) {
  const failures = [];
  if (!/^Connected/.test(result.connection) || /does not list the model/.test(result.connection)) failures.push(`connection test: ${result.connection}`);
  if (result.networkErrors.length) failures.push(`${result.networkErrors.length} network error(s)`);
  const errors = result.steps.filter((s) => s.badge === 'error');
  if (errors.length) failures.push(`${errors.length} step(s) failed: ${errors.map((s) => `${s.name} (${s.error})`).join('; ')}`);
  const unreadable = result.steps.filter((s) => s.checks && !['pass', 'fixed'].includes(s.checks[0]?.status));
  if (unreadable.length) failures.push(`${unreadable.length} reply(s) not in the expected format`);
  const good = result.steps.filter((s) => s.badge === 'verified' || s.badge === 'corrected').length;
  result.goodShare = result.steps.length ? good / result.steps.length : 0;
  if (result.goodShare < MIN_GOOD_SHARE) failures.push(`only ${good} of ${result.steps.length} replies Verified or Corrected`);
  const savable = result.steps.filter((s) => s.badge === 'unverified' && s.saveDisabled === false);
  if (savable.length) failures.push('an Unverified reply could be saved');
  result.failures = failures;
  result.passed = !failures.length;
  return result;
}

function markdown(results) {
  const lines = ['## Live AI provider test', '', `Site: ${BASE}`, ''];
  for (const r of results) {
    lines.push(`### ${r.provider} (${r.model}): ${r.passed ? 'passed' : 'FAILED'}`, '', `Connection: ${r.connection}`, '');
    if (r.models?.length) lines.push(`<details><summary>${r.models.length} models available to this key</summary>\n\n${r.models.join(', ')}\n\n</details>`, '');
    lines.push('| Step | Badge | Seconds | Checks not passed | Reply |', '|---|---|---|---|---|');
    for (const s of r.steps) {
      const notes = s.error ?? (s.checks ?? []).filter((c) => c.status !== 'pass' && c.status !== 'skip').map((c) => `${c.label}: ${c.status}${c.detail ? ` (${c.detail})` : ''}`).join('; ');
      lines.push(`| ${s.name} | ${s.badge}${s.hasCorrection ? ' + correction' : ''} | ${s.seconds} | ${(notes || '').replaceAll('|', '/')} | ${(s.text ?? '').replaceAll('|', '/')} |`);
    }
    if (r.networkErrors.length) lines.push('', 'Network errors:', ...r.networkErrors.map((e) => `- ${e}`));
    if (r.failures.length) lines.push('', 'Failures:', ...r.failures.map((f) => `- ${f}`));
    lines.push('');
  }
  return lines.join('\n');
}

if (MOCK) {
  process.env.OPENAI_API_KEY = 'mock-key';
  process.env.OPENAI_MODEL = 'mock-model'; // the model the scripted provider lists
}
const tested = PROVIDERS.filter((p) => process.env[p.key] && (!MOCK || p.id === 'openai'));
const mock = MOCK ? await startMockAi(MOCK_PORT) : null;
if (!tested.length) {
  console.error('No provider keys set. Set ANTHROPIC_API_KEY, OPENAI_API_KEY and/or GEMINI_API_KEY.');
  process.exit(1);
}

let server;
if (LOCAL) {
  server = spawn(process.execPath, ['tools/site.mjs', '--serve'], { stdio: ['ignore', 'pipe', 'pipe'] });
  await new Promise((resolve, reject) => {
    let errors = '';
    server.stdout.on('data', (chunk) => { if (String(chunk).includes('Previewing')) resolve(); });
    server.stderr.on('data', (chunk) => { errors += chunk; });
    server.on('exit', (code) => reject(new Error(`The local site server stopped (exit ${code}). Is port 8080 already in use?\n${errors.trim()}`)));
    setTimeout(() => reject(new Error('The local site server did not start within 30 seconds.')), 30_000);
  });
}
const browser = await chromium.launch();
const results = [];
for (const provider of tested) {
  console.error(`Testing ${provider.name}…`);
  results.push(await testProvider(browser, provider));
}
await browser.close();
server?.kill();
mock?.close();

const report = markdown(results);
console.log(report);
writeFileSync('live-ai-report.json', `${JSON.stringify({ site: BASE, date: new Date().toISOString(), results }, null, 2)}\n`);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${report}\n`);
process.exit(results.every((r) => r.passed) ? 0 : 1);
