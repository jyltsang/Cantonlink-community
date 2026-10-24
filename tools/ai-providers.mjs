// One chat interface over several AI providers, called straight from the
// learner's browser with their own key. There is deliberately no SDK: the
// site has no build step and no runtime dependencies, works offline, and
// speaks to four providers, so each adapter is a small fetch call.
//
// Conversation messages are provider-neutral:
//   { role: 'user', content }
//   { role: 'assistant', content, toolCalls: [{ id, name, args }], native }
//   { role: 'tool', id, name, content, isError }
// `native` keeps the provider's own message so it can be sent back unchanged
// (Claude, for example, requires earlier turns to be replayed exactly).

export const PROVIDERS = {
  anthropic: {
    label: 'Claude (Anthropic)',
    defaultModel: 'claude-opus-5-5',
    keyPlaceholder: 'sk-ant-…',
    keyUrl: 'https://console.anthropic.com/settings/keys',
    needsKey: true,
  },
  openai: {
    label: 'OpenAI',
    defaultModel: 'gpt-5-mini',
    keyPlaceholder: 'sk-…',
    keyUrl: 'https://platform.openai.com/api-keys',
    needsKey: true,
  },
  gemini: {
    label: 'Google Gemini',
    defaultModel: 'gemini-3.8-flash',
    keyPlaceholder: 'AIza…',
    keyUrl: 'https://aistudio.google.com/apikey',
    needsKey: true,
  },
  compatible: {
    label: 'OpenAI-compatible (Ollama, LM Studio, OpenRouter…)',
    defaultModel: '',
    defaultBaseUrl: 'http://localhost:11434/v1',
    keyPlaceholder: 'Optional for local servers',
    needsKey: false,
  },
};

export class ProviderError extends Error {}

const ANTHROPIC_VERSION = '2026-10-21';
// Models that accept server-side refusal fallbacks in the "default" form.
const ANTHROPIC_FALLBACK_MODELS = new Set(['claude-opus-5-5', 'claude-fable-5-1', 'claude-opus-5', 'claude-sonnet-5-5']);

// Busy or briefly failing providers are retried; anything else is reported
// at once. Each attempt has a time limit, so a request that never answers
// ends with an error instead of leaving the learner waiting.
const RETRY_STATUSES = new Set([429, 500, 502, 503, 504]);
const MAX_RETRY_WAIT = 20_000;

async function attempt(ctx, url, init, provider) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ctx.timeoutMs);
  try {
    const response = await ctx.fetch(url, { ...init, signal: controller.signal });
    const body = await response.json().catch(() => ({}));
    return { response, body };
  } catch (error) {
    if (controller.signal.aborted) throw new ProviderError(`${PROVIDERS[provider].label} took too long to answer (over ${Math.round(ctx.timeoutMs / 1000)} seconds). The model may be busy: try again, or choose a faster model in AI settings.`);
    throw new ProviderError(`Could not reach ${PROVIDERS[provider].label}. Check your connection${provider === 'compatible' ? ', that the server is running, and that it allows requests from this site (for Ollama, set OLLAMA_ORIGINS)' : ''}.`);
  } finally {
    clearTimeout(timer);
  }
}

async function request(ctx, url, init, provider) {
  let response;
  let body;
  for (let tries = 0; ; tries++) {
    ({ response, body } = await attempt(ctx, url, init, provider));
    if (response.ok || !RETRY_STATUSES.has(response.status) || tries >= ctx.retryDelays.length) break;
    const retryAfter = Number(response.headers?.get?.('retry-after')) * 1000;
    await ctx.sleep(Math.min(retryAfter > 0 ? retryAfter : ctx.retryDelays[tries], MAX_RETRY_WAIT));
  }
  if (!response.ok) {
    const message = body?.error?.message ?? body?.message ?? response.statusText;
    if (response.status === 401 || response.status === 403) throw new ProviderError(`The API key was rejected (${response.status}). ${message}`);
    if (response.status === 404) throw new ProviderError(`Not found (404): check the model name. ${message}`);
    if (response.status === 429) throw new ProviderError(`Rate limit or quota reached (429), even after retrying. ${message}`);
    if (RETRY_STATUSES.has(response.status)) throw new ProviderError(`${PROVIDERS[provider].label} is busy (${response.status}), even after retrying. Try again in a minute, or choose another model in AI settings. ${message}`);
    throw new ProviderError(`${PROVIDERS[provider].label} returned an error (${response.status}). ${message}`);
  }
  return body;
}

const safeJson = (text) => {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

// Group consecutive tool results so they go back in a single message.
function groupTools(messages) {
  const out = [];
  for (const m of messages) {
    if (m.role === 'tool' && out.at(-1)?.role === 'tools') out.at(-1).items.push(m);
    else if (m.role === 'tool') out.push({ role: 'tools', items: [m] });
    else out.push(m);
  }
  return out;
}

// --- Claude ---------------------------------------------------------------

function anthropicAdapter({ apiKey, model, http }) {
  const headers = {
    'content-type': 'application/json',
    'x-api-key': apiKey,
    'anthropic-version': ANTHROPIC_VERSION,
    'anthropic-dangerous-direct-browser-access': 'true',
  };
  return {
    async send({ system, messages, tools = [], schema }) {
      const body = {
        model,
        max_tokens: 16000,
        system,
        messages: groupTools(messages).map((m) => {
          if (m.role === 'tools') return { role: 'user', content: m.items.map((t) => ({ type: 'tool_result', tool_use_id: t.id, content: t.content, is_error: Boolean(t.isError) })) };
          if (m.role === 'assistant') {
            if (m.native?.provider === 'anthropic') return { role: 'assistant', content: m.native.data };
            return { role: 'assistant', content: [...(m.content ? [{ type: 'text', text: m.content }] : []), ...(m.toolCalls ?? []).map((c) => ({ type: 'tool_use', id: c.id, name: c.name, input: c.args }))] };
          }
          return { role: 'user', content: m.content };
        }),
        output_config: { effort: 'medium', ...(schema ? { format: { type: 'json_schema', schema } } : {}) },
      };
      if (tools.length) body.tools = tools.map((t) => ({ name: t.name, description: t.description, input_schema: t.inputSchema }));
      const extra = {};
      if (ANTHROPIC_FALLBACK_MODELS.has(model)) {
        extra['anthropic-beta'] = 'server-side-fallback-2026-07-01';
        body.fallbacks = 'default';
      }
      const data = await request(http, 'https://api.anthropic.com/v1/messages', { method: 'POST', headers: { ...headers, ...extra }, body: JSON.stringify(body) }, 'anthropic');
      if (data.stop_reason === 'refusal') throw new ProviderError('The model declined to answer this. Try rephrasing.');
      const content = data.content ?? [];
      return {
        text: content.filter((b) => b.type === 'text').map((b) => b.text).join(''),
        toolCalls: content.filter((b) => b.type === 'tool_use').map((b) => ({ id: b.id, name: b.name, args: b.input ?? {} })),
        native: { provider: 'anthropic', data: content },
        truncated: data.stop_reason === 'max_tokens',
      };
    },
    async listModels() {
      const data = await request(http, 'https://api.anthropic.com/v1/models?limit=100', { headers }, 'anthropic');
      return (data.data ?? []).map((m) => m.id);
    },
  };
}

// --- OpenAI and OpenAI-compatible -----------------------------------------

function openaiAdapter({ apiKey, model, baseUrl, http, provider }) {
  const base = (baseUrl || 'https://api.openai.com/v1').replace(/\/+$/, '');
  const headers = { 'content-type': 'application/json', ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}) };
  return {
    async send({ system, messages, tools = [], schema }) {
      const body = {
        model,
        messages: [
          { role: 'system', content: system },
          ...messages.map((m) => {
            if (m.role === 'tool') return { role: 'tool', tool_call_id: m.id, content: m.content };
            if (m.role === 'assistant') {
              if (m.native?.provider === provider) return m.native.data;
              return { role: 'assistant', content: m.content || null, ...(m.toolCalls?.length ? { tool_calls: m.toolCalls.map((c) => ({ id: c.id, type: 'function', function: { name: c.name, arguments: JSON.stringify(c.args) } })) } : {}) };
            }
            return { role: 'user', content: m.content };
          }),
        ],
      };
      if (tools.length) body.tools = tools.map((t) => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.inputSchema } }));
      // Native JSON-schema output on OpenAI itself; compatible servers vary, so
      // they rely on the prompt and the structure check.
      if (schema && provider === 'openai') body.response_format = { type: 'json_schema', json_schema: { name: 'reply', schema, strict: true } };
      const data = await request(http, `${base}/chat/completions`, { method: 'POST', headers, body: JSON.stringify(body) }, provider);
      const choice = data.choices?.[0];
      if (!choice) throw new ProviderError('The provider returned no answer.');
      const message = choice.message ?? {};
      if (message.refusal) throw new ProviderError(`The model declined: ${message.refusal}`);
      return {
        text: message.content ?? '',
        toolCalls: (message.tool_calls ?? []).map((c) => ({ id: c.id, name: c.function?.name, args: safeJson(c.function?.arguments) ?? { __invalid: c.function?.arguments } })),
        native: { provider, data: message },
        truncated: choice.finish_reason === 'length',
      };
    },
    async listModels() {
      const data = await request(http, `${base}/models`, { headers }, provider);
      return (data.data ?? []).map((m) => m.id);
    },
  };
}

// --- Gemini ---------------------------------------------------------------

// Gemini accepts a subset of JSON Schema for function parameters.
function geminiSchema(schema) {
  const out = {};
  for (const key of ['type', 'description', 'enum', 'required']) if (schema[key] !== undefined) out[key] = schema[key];
  if (schema.properties) out.properties = Object.fromEntries(Object.entries(schema.properties).map(([k, v]) => [k, geminiSchema(v)]));
  if (schema.items) out.items = geminiSchema(schema.items);
  return out;
}

function geminiAdapter({ apiKey, model, http }) {
  const base = 'https://generativelanguage.googleapis.com/v1beta';
  const headers = { 'content-type': 'application/json', 'x-goog-api-key': apiKey };
  return {
    async send({ system, messages, tools = [], schema }) {
      const body = {
        systemInstruction: { parts: [{ text: system }] },
        contents: groupTools(messages).map((m) => {
          if (m.role === 'tools') return { role: 'user', parts: m.items.map((t) => ({ functionResponse: { name: t.name, response: { content: t.content } } })) };
          if (m.role === 'assistant') {
            if (m.native?.provider === 'gemini') return m.native.data;
            return { role: 'model', parts: [...(m.content ? [{ text: m.content }] : []), ...(m.toolCalls ?? []).map((c) => ({ functionCall: { name: c.name, args: c.args } }))] };
          }
          return { role: 'user', parts: [{ text: m.content }] };
        }),
      };
      if (tools.length) body.tools = [{ functionDeclarations: tools.map((t) => ({ name: t.name, description: t.description, parameters: geminiSchema(t.inputSchema) })) }];
      else if (schema) body.generationConfig = { responseMimeType: 'application/json' };
      const data = await request(http, `${base}/models/${encodeURIComponent(model)}:generateContent`, { method: 'POST', headers, body: JSON.stringify(body) }, 'gemini');
      const candidate = data.candidates?.[0];
      if (!candidate?.content) throw new ProviderError(candidate?.finishReason === 'SAFETY' ? 'The model declined to answer this. Try rephrasing.' : 'The provider returned no answer.');
      const parts = candidate.content.parts ?? [];
      return {
        text: parts.filter((p) => typeof p.text === 'string' && !p.thought).map((p) => p.text).join(''),
        toolCalls: parts.filter((p) => p.functionCall).map((p, i) => ({ id: `call_${i}`, name: p.functionCall.name, args: p.functionCall.args ?? {} })),
        native: { provider: 'gemini', data: candidate.content },
        truncated: candidate.finishReason === 'MAX_TOKENS',
      };
    },
    async listModels() {
      const data = await request(http, `${base}/models?pageSize=200`, { headers }, 'gemini');
      return (data.models ?? []).filter((m) => (m.supportedGenerationMethods ?? []).includes('generateContent')).map((m) => m.name.replace(/^models\//, ''));
    },
  };
}

export function createClient({
  provider, apiKey = '', model, baseUrl = '', fetch = globalThis.fetch.bind(globalThis),
  timeoutMs = 90_000, retryDelays = [2_000, 6_000], sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
}) {
  if (!PROVIDERS[provider]) throw new ProviderError(`Unknown provider "${provider}".`);
  if (PROVIDERS[provider].needsKey && !apiKey) throw new ProviderError('Add an API key first.');
  if (!model) throw new ProviderError('Choose a model first.');
  const http = { fetch, timeoutMs, retryDelays, sleep };
  if (provider === 'anthropic') return anthropicAdapter({ apiKey, model, http });
  if (provider === 'gemini') return geminiAdapter({ apiKey, model, http });
  return openaiAdapter({ apiKey, model, baseUrl: provider === 'compatible' ? (baseUrl || PROVIDERS.compatible.defaultBaseUrl) : '', http, provider });
}
