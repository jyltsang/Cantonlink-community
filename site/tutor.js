import { PROVIDERS, ProviderError } from './ai-providers.js';
import { CHECKS, checkLearnerText } from './ai-checks.js';
import { checkedAnswer, tutorSystem, SCENARIOS, TASKS } from './ai-tutor.js';
import { TOOLS } from './tool-definitions.js';
import { buildLexicon } from './library.js';
import { ai, saveAi, setProvider, forgetKey, aiReady, makeClient } from './ai-settings.js';
import {
  REPO, LEVELS, settings, h, show, sentenceEl, pageHead, chips, savePhrase, isPhraseSaved,
} from './lib.js';

let lexicon;
const lexiconFor = (data) => (lexicon ??= buildLexicon(data));
const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, reducedMotion() ? 0 : ms));

const STATUS_TEXT = { pass: 'Passed', fixed: 'Fixed', warn: 'Note', fail: 'Failed', skip: 'Skipped', pending: 'Waiting', running: 'Running' };
const BADGE_TEXT = {
  verified: ['Verified', 'Passed every check.'],
  corrected: ['Corrected', 'Something was fixed by the checks; see what changed.'],
  unverified: ['Unverified', 'Still failing after one retry. Do not learn from this reply.'],
};

// --- The checks bar -------------------------------------------------------

export function checksView(steps, { badge, live = false } = {}) {
  const counted = steps.filter((s) => !['skip', 'pending', 'running'].includes(s.status));
  const passed = counted.filter((s) => ['pass', 'fixed', 'warn'].includes(s.status)).length;
  const list = h('ol', { class: 'checks-list' }, steps.map((s) => h('li', { class: `check check-${s.status}` },
    h('span', { class: 'check-status' }, STATUS_TEXT[s.status]),
    h('span', { class: 'check-label' }, s.status === 'running' ? (CHECKS.find((c) => c.id === s.id)?.running ?? s.label) : s.label),
    s.detail && s.status !== 'running' ? h('span', { class: 'check-detail' }, s.detail) : null)));
  if (live) return h('div', { class: 'checks live', role: 'status', 'aria-live': 'polite' }, h('p', { class: 'checks-title' }, 'Checking this reply…'), list);
  const [label, meaning] = BADGE_TEXT[badge];
  return h('details', { class: `checks badge-${badge}` },
    h('summary', {}, h('span', { class: `badge badge-${badge}` }, label), ` ${passed} of ${counted.length} checks passed · ${meaning}`),
    list);
}

async function revealChecks(steps, onUpdate) {
  const shown = steps.map((s) => ({ ...s, status: 'pending' }));
  for (let i = 0; i < steps.length; i++) {
    shown[i].status = 'running';
    onUpdate(shown);
    await wait(140);
    shown[i] = { ...steps[i] };
    onUpdate(shown);
  }
}

// --- Settings page --------------------------------------------------------

export function aiSettingsView(data, rerender) {
  const p = PROVIDERS[ai.provider];
  const status = h('p', { class: 'small', role: 'status', id: 'ai-status' });
  const models = h('datalist', { id: 'model-list' });
  const keyInput = h('input', {
    type: 'password', id: 'ai-key', class: 'field', value: ai.apiKey, autocomplete: 'off', spellcheck: 'false', placeholder: p.keyPlaceholder,
    oninput: (e) => { ai.apiKey = e.target.value.trim(); saveAi(); },
  });

  const test = async () => {
    status.textContent = 'Testing…';
    try {
      const list = await makeClient().listModels();
      models.replaceChildren(...list.map((id) => h('option', { value: id })));
      status.textContent = `Connected. ${list.length} model${list.length === 1 ? '' : 's'} available${list.length ? '; pick one from the model list if you like' : ''}.`;
    } catch (error) {
      status.textContent = error instanceof ProviderError ? error.message : `Could not connect: ${error.message}`;
    }
  };

  show(
    ...pageHead('AI settings', { lede: 'Connect the AI model of your choice with your own API key to unlock the AI tutor, explanations and translations. Everything else on this site works without a key.' }),
    h('div', { class: 'panel form' },
      h('fieldset', {},
        h('legend', {}, 'Provider'),
        Object.entries(PROVIDERS).map(([id, info]) => h('label', { class: 'radio' },
          h('input', { type: 'radio', name: 'provider', value: id, checked: ai.provider === id, onchange: () => { setProvider(id); rerender(); } }), ` ${info.label}`))),
      h('label', { for: 'ai-key', class: 'label' }, `API key${p.needsKey ? '' : ' (optional)'}`),
      h('div', { class: 'field-row' }, keyInput,
        h('button', { class: 'btn', type: 'button', onclick: (e) => { keyInput.type = keyInput.type === 'password' ? 'text' : 'password'; e.target.textContent = keyInput.type === 'password' ? 'Show' : 'Hide'; } }, 'Show')),
      p.keyUrl ? h('p', { class: 'small' }, 'Get a key from ', h('a', { href: p.keyUrl, target: '_blank', rel: 'noopener' }, p.label), '. Set a monthly spending limit there.') : null,
      ai.provider === 'compatible' ? [
        h('label', { for: 'ai-base', class: 'label' }, 'Server address (base URL)'),
        h('input', { id: 'ai-base', class: 'field', value: ai.baseUrl, placeholder: PROVIDERS.compatible.defaultBaseUrl, oninput: (e) => { ai.baseUrl = e.target.value.trim(); saveAi(); } }),
        h('p', { class: 'small' }, 'For Ollama on this computer, start it with OLLAMA_ORIGINS set to this site\'s address so the browser may connect. Hosted services: OpenRouter, Groq, Together, DeepSeek and Mistral are allowed by this site.'),
      ] : null,
      h('label', { for: 'ai-model', class: 'label' }, 'Model'),
      h('input', { id: 'ai-model', class: 'field', value: ai.model, list: 'model-list', placeholder: p.defaultModel || 'e.g. llama3.1', oninput: (e) => { ai.model = e.target.value.trim(); saveAi(); } }),
      models,
      h('p', { class: 'small' }, p.defaultModel ? `Default: ${p.defaultModel}. Model names change; "Test connection" lists the ones your account can use.` : 'Type the model name your server runs, or use "Test connection" to list them.'),
      h('label', { class: 'check-row' }, h('input', { type: 'checkbox', checked: ai.remember, onchange: (e) => { ai.remember = e.target.checked; saveAi(); } }), ' Remember the key on this device'),
      h('label', { class: 'check-row' }, h('input', { type: 'checkbox', checked: ai.secondOpinion, onchange: (e) => { ai.secondOpinion = e.target.checked; saveAi(); } }), ' Second opinion: ask the model to review each reply (uses more tokens)'),
      h('div', { class: 'actions' },
        h('button', { class: 'btn', type: 'button', onclick: test }, 'Test connection'),
        h('a', { class: 'btn btn-primary', href: '#/tutor' }, 'Open the AI tutor'),
        h('button', { class: 'btn btn-quiet', type: 'button', onclick: () => { forgetKey(); rerender(); } }, 'Forget key')),
      status),
    h('section', { class: 'privacy' },
      h('h2', {}, 'Your key and your privacy'),
      h('ul', {},
        h('li', {}, 'Your key is sent only to the provider you chose, directly from your browser. This site has no server and never sees it.'),
        h('li', {}, 'By default the key is kept only until you close or reload the page. "Remember" stores it in this browser; do not use that on a shared computer.'),
        h('li', {}, 'What you type in the tutor is sent to your provider under their terms. Conversations are not saved by this site.'),
        h('li', {}, 'You pay your provider for what you use. A short lesson typically costs a few cents; set a spending limit with your provider.'),
        h('li', {}, h('a', { href: `${REPO}/blob/main/docs/AI_TUTOR.md` }, 'Read the AI tutor guide'), ' for step-by-step setup, costs and free local models.'))),
  );
}

export function needsKeyPanel(what = 'This feature') {
  return h('div', { class: 'panel unlock' },
    h('p', {}, `${what} uses an AI model with your own API key (Claude, OpenAI, Gemini, or a free local model).`),
    h('a', { class: 'btn btn-primary', href: '#/ai' }, 'Add an API key'));
}

// --- Chat screen ----------------------------------------------------------

const chat = { mode: 'friend', level: 'A1', scenario: 'free', history: [], items: [], busy: false };

function tutorMessage(item, data, onAction) {
  const v = item.value;
  if (!v) {
    return h('div', { class: 'msg msg-tutor unverified' },
      h('p', {}, 'The tutor\'s reply could not be read, even after a retry.'),
      checksView(item.steps, { badge: item.badge }));
  }
  const saved = isPhraseSaved(v.reply.cjk);
  const byId = new Map(data.grammar.map((p) => [p.id, p]));
  return h('div', { class: `msg msg-tutor ${item.badge === 'unverified' ? 'unverified' : ''}` },
    h('p', { class: 'msg-label' }, 'Tutor · AI-generated, checked below'),
    sentenceEl(v.reply.tokens),
    h('p', { class: 'en' }, v.reply.en),
    v.correction ? h('div', { class: 'correction' },
      h('p', { class: 'correction-title' }, 'Correction'),
      v.correction.learner_said ? h('p', { class: 'small' }, 'You wrote: ', h('span', { lang: 'yue-Hant-HK' }, v.correction.learner_said)) : null,
      sentenceEl(v.correction.better.tokens),
      h('p', { class: 'en' }, v.correction.better.en),
      h('p', { class: 'small' }, v.correction.explanation),
      v.correction.pattern_id ? h('p', { class: 'small' }, 'Pattern: ', h('a', { href: `#/grammar/${v.correction.pattern_id}`, lang: 'yue-Hant-HK' }, byId.get(v.correction.pattern_id).pattern)) : null) : null,
    v.note ? h('p', { class: 'small note' }, v.note) : null,
    v.patterns?.length ? h('p', { class: 'small' }, 'Grammar used: ', v.patterns.map((id, i) => [i ? ', ' : '', h('a', { href: `#/grammar/${id}`, lang: 'yue-Hant-HK' }, byId.get(id).pattern)])) : null,
    checksView(item.steps, { badge: item.badge }),
    h('div', { class: 'msg-actions' },
      h('button', { class: 'btn btn-small', type: 'button', disabled: item.badge === 'unverified' || saved, title: item.badge === 'unverified' ? 'Unverified replies cannot be saved' : '', onclick: () => { savePhrase(v.reply); onAction(); } }, saved ? 'Saved for review' : 'Save phrase'),
      h('button', { class: 'btn btn-small', type: 'button', disabled: chat.busy, onclick: () => onAction('explain') }, 'Explain'),
      h('a', { class: 'btn btn-small btn-quiet', target: '_blank', rel: 'noopener', href: issueUrl(v, item.steps) }, 'Report')));
}

function issueUrl(v, steps) {
  const current = [`${v.reply.cjk}`, v.reply.jyutping, `"${v.reply.en}"`, '', 'Checks:', ...steps.map((s) => `- ${s.label}: ${s.status}${s.detail ? ` (${s.detail})` : ''}`)].join('\n').slice(0, 1500);
  return `${REPO}/issues/new?template=content-error.yml&title=${encodeURIComponent('[AI tutor] ' + v.reply.cjk.slice(0, 40))}&entry=${encodeURIComponent('AI tutor reply')}&current=${encodeURIComponent(current)}`;
}

function pendingMessage(item) {
  return h('div', { class: 'msg msg-tutor pending' },
    h('p', { class: 'msg-label' }, 'Tutor'),
    h('ul', { class: 'activity' }, item.activity.map((a) => h('li', {}, a))),
    item.steps ? checksView(item.steps, { live: true }) : null);
}

export function tutorView(data, query) {
  if (!aiReady()) {
    show(...pageHead('AI tutor', { lede: 'Practise real conversations in Cantonese. Every reply is checked against this library before you rely on it.' }), needsKeyPanel('The AI tutor'));
    return () => tutorView(data, query);
  }
  const prefill = query.get('ask') ?? '';
  const log = h('div', { class: 'chat-log', 'aria-live': 'off' });
  const input = h('textarea', {
    id: 'chat-input', class: 'chat-input', rows: 2, placeholder: 'Write in characters, Jyutping or English…',
    onkeydown: (e) => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); send(); } },
  }, prefill);
  const sendButton = h('button', { class: 'btn btn-primary', type: 'button', onclick: () => send() }, 'Send');
  const checkButton = h('button', { class: 'btn', type: 'button', onclick: () => send({ check: true }) }, 'Check my sentence');

  const renderLog = () => {
    log.replaceChildren(...chat.items.map((item) => {
      if (item.role === 'learner') {
        return h('div', { class: 'msg msg-learner' },
          h('p', { lang: /\p{Script=Han}/u.test(item.text) ? 'yue-Hant-HK' : undefined }, item.text),
          item.notes?.length ? h('div', { class: 'learner-notes' }, h('p', { class: 'small' }, 'Quick check:'), h('ul', {}, item.notes.map((n) => h('li', {}, n)))) : null);
      }
      if (item.role === 'error') return h('div', { class: 'msg msg-error', role: 'alert' }, h('p', {}, item.text), h('a', { href: '#/ai' }, 'Check AI settings'));
      if (item.pending) return pendingMessage(item);
      return tutorMessage(item, data, (action) => (action === 'explain' ? send({ explain: true }) : renderLog()));
    }));
    for (const b of [sendButton, checkButton]) b.disabled = chat.busy;
    log.lastElementChild?.scrollIntoView({ block: 'nearest' });
  };

  async function ask(userContent, display) {
    if (display) chat.items.push(display);
    chat.history.push({ role: 'user', content: userContent, hidden: !display });
    const pending = { role: 'tutor', pending: true, activity: ['Thinking…'], steps: null };
    chat.items.push(pending);
    chat.busy = true;
    renderLog();
    const onEvent = (e) => {
      if (e.type === 'tool') pending.activity.push(`Looked up in the library: ${e.name.replaceAll('_', ' ')}${e.args?.id ? ` (${e.args.id})` : e.args?.query ? ` "${e.args.query}"` : ''}`);
      if (e.type === 'stage' && e.stage === 'retrying') pending.activity.push('Some checks failed; asking the tutor to correct its reply…');
      if (e.type === 'stage' && e.stage === 'opinion') pending.activity.push('Asking for a second opinion…');
      renderLog();
    };
    try {
      const result = await checkedAnswer({
        client: makeClient(), system: tutorSystem({ data, ...chat }), history: chat.history, kind: 'tutor',
        data, lexicon: lexiconFor(data), tools: TOOLS, secondOpinionOn: ai.secondOpinion, onEvent,
      });
      await revealChecks(result.steps, (steps) => { pending.steps = steps; renderLog(); });
      Object.assign(pending, { pending: false, value: result.value, steps: result.steps, badge: result.badge });
    } catch (error) {
      chat.items.splice(chat.items.indexOf(pending), 1, { role: 'error', text: error instanceof ProviderError ? error.message : `Something went wrong: ${error.message}` });
    }
    chat.busy = false;
    renderLog();
    input.focus();
  }

  function send({ check = false, explain = false } = {}) {
    if (chat.busy) return;
    if (explain) {
      ask('Explain the grammar and vocabulary in your last reply simply, in the "note" field, and continue the conversation.', { role: 'learner', text: 'Can you explain that?' });
      return;
    }
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    const notes = checkLearnerText(text);
    ask(check ? `Please check my sentence and correct it if needed, then continue: ${text}` : text, { role: 'learner', text, notes });
  }

  const start = () => {
    Object.assign(chat, { history: [], items: [] });
    ask(`Start our conversation with a short greeting and one simple question for the scenario.`, null);
  };

  function draw() {
    const controls = h('div', { class: 'tutor-controls' },
      chips([['friend', 'Friend'], ['sifu', 'Sifu (corrects you)']], chat.mode, (m) => { chat.mode = m; draw(); }, 'Tutor mode'),
      h('div', { class: 'toolbar' },
        h('select', { class: 'chip', 'aria-label': 'Level', onchange: (e) => { chat.level = e.target.value; } }, LEVELS.map((l) => h('option', { value: l, selected: chat.level === l }, `Level ${l}`))),
        h('select', { class: 'chip', 'aria-label': 'Scenario', onchange: (e) => { chat.scenario = e.target.value; } }, Object.entries(SCENARIOS).map(([id, label]) => h('option', { value: id, selected: chat.scenario === id }, label[0].toUpperCase() + label.slice(1)))),
        h('button', { class: 'btn btn-small', type: 'button', disabled: chat.busy, onclick: start }, 'New chat')),
      h('p', { class: 'small' }, `${PROVIDERS[ai.provider].label} · ${ai.model} · `, h('a', { href: '#/ai' }, 'Change')));
    show(
      ...pageHead('AI tutor', { lede: 'Chat in Cantonese. Each reply is checked against this library: valid Jyutping, one syllable per character, spoken (not written) Chinese, library readings, and real grammar references.' }),
      controls,
      log,
      h('div', { class: 'composer' }, h('label', { for: 'chat-input', class: 'visually-hidden' }, 'Your message'), input, h('div', { class: 'actions' }, sendButton, checkButton)),
      h('p', { class: 'small' }, `Display: ${settings.system}. Change romanisation under Display. `, h('a', { href: `${REPO}/blob/main/docs/AI_TUTOR.md#how-replies-are-checked` }, 'How replies are checked')),
    );
    renderLog();
  }

  draw();
  if (!chat.items.length) start();
  return draw;
}

// --- Explain and translate (used on other pages) --------------------------

export function aiTaskSection(data, { task, label, intro }) {
  const out = h('div', { class: 'ai-task' });
  if (!aiReady()) {
    out.append(h('p', { class: 'small' }, intro, ' ', h('a', { href: '#/ai' }, 'Add an API key'), ' to use it.'));
    return out;
  }
  const run = async () => {
    button.disabled = true;
    out.replaceChildren(h('p', { class: 'small', role: 'status' }, 'Asking the AI and checking its answer…'));
    try {
      const { kind, prompt } = task;
      const result = await checkedAnswer({
        client: makeClient(), system: 'You help learners of spoken Hong Kong Cantonese. Use natural spoken Cantonese, never Standard Written Chinese (佢 not 他, 係 not 是, 嘅 not 的, 唔 not 不, 咗 not 了). Jyutping must have tone numbers 1–6, one syllable per character. Answer with one JSON object and nothing else.',
        history: [{ role: 'user', content: prompt }], kind, data, lexicon: lexiconFor(data), secondOpinionOn: ai.secondOpinion,
      });
      const v = result.value;
      out.replaceChildren(
        h('p', { class: 'msg-label' }, 'AI-generated · checked below'),
        ...(v ? (kind === 'sentence'
          ? [sentenceEl(v.tokens), h('p', { class: 'en' }, v.en)]
          : [h('p', {}, v.explanation), ...v.examples.map((ex) => h('div', { class: 'example' }, sentenceEl(ex.tokens), h('p', { class: 'en' }, ex.en)))]) : [h('p', {}, 'The answer could not be read.')]),
        checksView(result.steps, { badge: result.badge }),
      );
    } catch (error) {
      out.replaceChildren(h('p', { role: 'alert' }, error instanceof ProviderError ? error.message : `Something went wrong: ${error.message}`));
    }
  };
  const button = h('button', { class: 'btn', type: 'button', onclick: run }, label);
  out.append(button);
  return out;
}

export const translateTask = (english) => TASKS.translate(english);
export const explainTask = (pattern) => TASKS.explain(pattern);
