import { PROVIDERS, createClient } from './ai-providers.js';

// The learner's AI settings. The API key stays in memory for this visit only,
// unless they tick "Remember on this device".
const STORAGE_KEY = 'cantonlink-ai';
const DEFAULTS = { provider: 'anthropic', model: PROVIDERS.anthropic.defaultModel, baseUrl: '', remember: false, secondOpinion: false, apiKey: '' };

function load() {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') };
  } catch {
    return { ...DEFAULTS };
  }
}

export const ai = load();

export function saveAi() {
  const { apiKey, ...rest } = ai;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ai.remember ? ai : rest));
  } catch {
    // Storage blocked: settings last for this visit only.
  }
}

export function setProvider(provider) {
  ai.provider = provider;
  ai.model = PROVIDERS[provider].defaultModel;
  ai.baseUrl = provider === 'compatible' ? PROVIDERS.compatible.defaultBaseUrl : '';
  saveAi();
}

export function forgetKey() {
  ai.apiKey = '';
  ai.remember = false;
  saveAi();
}

export const aiReady = () => Boolean(ai.model && (ai.apiKey || !PROVIDERS[ai.provider].needsKey));

export const makeClient = () => createClient({ provider: ai.provider, apiKey: ai.apiKey, model: ai.model, baseUrl: ai.baseUrl });
