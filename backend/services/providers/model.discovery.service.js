/**
 * KI-OS Community Edition — Core Infrastructure
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: Apache License 2.0
 * SPDX-License-Identifier: Apache-2.0
 */
/**
 * (c) 2026 KI-OS.org (v6.1) by Ingo Schaffer und Kimba
 * Datei: model.discovery.service.js
 * Diese Datei ruft aktuelle Modelllisten der Pflicht-Provider ab, normalisiert sie und wählt daraus die besten Kandidaten pro Rolle.
 * Sie dient als dynamische Discovery-Schicht für api.kimba.in, damit KI-OS nicht auf veraltete, hart codierte Modellnamen angewiesen ist.
 * @license AGPL-3.0-only
 */

'use strict';

const DEFAULT_TIMEOUT_MS = Number(process.env.MODEL_DISCOVERY_TIMEOUT_MS || 15000);
const PROVIDERS = ['openai', 'anthropic', 'gemini', 'deepseek', 'openrouter', 'dashscope'];

function withTimeout(fetchImpl, timeoutMs = DEFAULT_TIMEOUT_MS) {
  return async (url, options = {}) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetchImpl(url, { ...options, signal: controller.signal });
    } finally {
      clearTimeout(timeout);
    }
  };
}

function normalizeDate(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value * 1000;
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function extractVersionRank(id) {
  const text = String(id || '').toLowerCase();
  const numbers = [...text.matchAll(/(\d+(?:\.\d+)?)/g)].map(m => Number(m[1]));
  if (!numbers.length) return 0;
  return numbers.reduce((acc, n, idx) => acc + (n / Math.pow(100, idx)), 0);
}

function isPreviewish(model) {
  const text = String(model.id || model.name || '').toLowerCase();
  return /preview|experimental|exp|beta|alpha|rc|canary/.test(text);
}

function isDeprecatedModel(model) {
  const text = String(model.id || model.name || '').toLowerCase();
  return /deprecated|deprecation|legacy|old/.test(text);
}

function classifyRole(id, provider) {
  const text = String(id || '').toLowerCase();
  const roles = new Set(['default']);

  if (/mini|flash|haiku|nano|lite|small|turbo|chat/.test(text)) roles.add('fast');
  if (/reason|reasoning|opus|pro|sonnet|thinking|r1|r2|o3|o4|gpt-5/.test(text)) roles.add('reasoning');
  if (/research|reason|reasoning|opus|pro|deep/.test(text)) roles.add('research');
  if (/vision|multimodal|image|live/.test(text) || provider === 'gemini' || provider === 'openai') roles.add('vision');
  if (/code|coder|coding|sonnet|opus|gpt-5|qwen|deepseek/.test(text)) roles.add('code');
  if (provider === 'openrouter') roles.add('fallback');
  if (provider === 'deepseek' && /chat/.test(text)) roles.add('low_cost');
  if (provider === 'deepseek' && /reason/.test(text)) roles.add('reasoning');
  if (provider === 'deepseek') roles.add('low_cost');
  if (provider === 'dashscope') roles.add('low_cost');
  if (provider === 'dashscope' && /coder|code/.test(text)) roles.add('code');

  return Array.from(roles);
}

function buildCandidate(provider, raw) {
  const id = String(raw.id || raw.name || '').replace(/^models\//, '');
  return {
    provider,
    id,
    name: raw.displayName || raw.name || raw.id || id,
    createdAt: normalizeDate(raw.created_at || raw.created || raw.updated_at),
    versionRank: extractVersionRank(id),
    preview: isPreviewish({ id }),
    deprecated: isDeprecatedModel({ id }),
    inputModalities: raw.input_modalities || raw.inputModalities || raw.supported_generation_methods || [],
    outputModalities: raw.output_modalities || raw.outputModalities || [],
    roles: classifyRole(id, provider),
    raw
  };
}

function sortCandidates(a, b) {
  if (a.deprecated !== b.deprecated) return a.deprecated ? 1 : -1;
  if (a.preview !== b.preview) return a.preview ? 1 : -1;
  if (b.createdAt !== a.createdAt) return b.createdAt - a.createdAt;
  if (b.versionRank !== a.versionRank) return b.versionRank - a.versionRank;
  return String(a.id).localeCompare(String(b.id));
}

function pickRole(candidates, role, providerPreference) {
  const providerFiltered = providerPreference ? candidates.filter(c => c.provider === providerPreference) : candidates;
  let roleFiltered = providerFiltered.filter(c => c.roles.includes(role));
  if (role === 'default') {
    const generalPurpose = roleFiltered.filter(c => !/mini|flash|haiku|nano|lite|small|turbo/.test(String(c.id).toLowerCase()));
    if (generalPurpose.length) roleFiltered = generalPurpose;
  }
  return (roleFiltered.length ? roleFiltered : providerFiltered).slice().sort(sortCandidates)[0] || null;
}

function buildRoleMap(allCandidates, env = process.env) {
  const roles = {};
  const preference = {
    default: env.ROUTER_DEFAULT_PROVIDER || 'openai',
    fast: env.ROUTER_FAST_PROVIDER || 'gemini',
    reasoning: env.ROUTER_REASONING_PROVIDER || 'anthropic',
    research: env.ROUTER_RESEARCH_PROVIDER || 'openai',
    code: env.ROUTER_CODE_PROVIDER || 'anthropic',
    low_cost: env.ROUTER_LOW_COST_PROVIDER || 'deepseek',
    fallback: env.ROUTER_FALLBACK_PROVIDER || 'openrouter',
    vision: env.ROUTER_DEFAULT_PROVIDER || 'openai'
  };

  for (const role of Object.keys(preference)) {
    const selected = pickRole(allCandidates, role, preference[role]) || pickRole(allCandidates, role) || pickRole(allCandidates, 'default');
    if (selected) {
      roles[role] = {
        provider: selected.provider,
        model: selected.id,
        preview: selected.preview,
        createdAt: selected.createdAt || null,
        source: 'discovery'
      };
    }
  }
  return roles;
}

function normalizeOpenAI(payload) {
  return (payload?.data || []).map(item => buildCandidate('openai', item));
}

function normalizeAnthropic(payload) {
  return (payload?.data || []).map(item => buildCandidate('anthropic', item));
}

function normalizeDeepSeek(payload) {
  return (payload?.data || []).map(item => buildCandidate('deepseek', item));
}

function normalizeOpenRouter(payload) {
  return (payload?.data || []).map(item => buildCandidate('openrouter', item));
}

function normalizeGemini(payload) {
  return (payload?.models || []).map(item => buildCandidate('gemini', item));
}

function providerConfig(provider, env = process.env) {
  switch (provider) {
    case 'openai':
      return {
        enabled: String(env.OPENAI_ENABLED || 'true') !== 'false' && !!env.OPENAI_API_KEY,
        url: `${env.OPENAI_API_BASE || 'https://api.openai.com/v1'}/models`,
        headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}` },
        normalize: normalizeOpenAI
      };
    case 'anthropic':
      return {
        enabled: String(env.ANTHROPIC_ENABLED || 'true') !== 'false' && !!env.ANTHROPIC_API_KEY,
        url: `${env.ANTHROPIC_API_BASE || 'https://api.anthropic.com'}/v1/models`,
        headers: {
          'x-api-key': env.ANTHROPIC_API_KEY,
          'anthropic-version': env.ANTHROPIC_VERSION || '2023-06-01'
        },
        normalize: normalizeAnthropic
      };
    case 'gemini':
      return {
        enabled: String(env.GEMINI_ENABLED || 'true') !== 'false' && !!env.GEMINI_API_KEY,
        url: `${env.GEMINI_API_BASE || 'https://generativelanguage.googleapis.com'}/v1beta/models?key=${encodeURIComponent(env.GEMINI_API_KEY)}`,
        headers: {},
        normalize: normalizeGemini
      };
    case 'deepseek':
      return {
        enabled: String(env.DEEPSEEK_ENABLED || 'true') !== 'false' && !!env.DEEPSEEK_API_KEY,
        url: `${env.DEEPSEEK_API_BASE || 'https://api.deepseek.com'}/models`,
        headers: { Authorization: `Bearer ${env.DEEPSEEK_API_KEY}` },
        normalize: normalizeDeepSeek
      };
    case 'openrouter':
      return {
        enabled: String(env.OPENROUTER_ENABLED || 'true') !== 'false' && !!env.OPENROUTER_API_KEY,
        url: `${env.OPENROUTER_API_BASE || 'https://openrouter.ai/api/v1'}/models`,
        headers: { Authorization: `Bearer ${env.OPENROUTER_API_KEY}` },
        normalize: normalizeOpenRouter
      };
    case 'dashscope':
      return {
        enabled: String(env.DASHSCOPE_ENABLED || 'false') !== 'false' && !!env.DASHSCOPE_API_KEY,
        url: `${env.DASHSCOPE_API_BASE || 'https://dashscope.aliyuncs.com/compatible-mode/v1'}/models`,
        headers: { Authorization: `Bearer ${env.DASHSCOPE_API_KEY}` },
        normalize: (payload) => (payload?.data || []).map(item => buildCandidate('dashscope', item))
      };
    default:
      return { enabled: false, url: '', headers: {}, normalize: () => [] };
  }
}

async function requestProviderModels(provider, options = {}) {
  const env = options.env || process.env;
  const fetchImpl = options.fetchImpl || global.fetch;
  if (typeof fetchImpl !== 'function') throw new Error('No fetch implementation available for model discovery');
  const cfg = providerConfig(provider, env);
  if (!cfg.enabled) return { provider, status: 'skipped', reason: 'missing_api_key', candidates: [] };

  const wrappedFetch = withTimeout(fetchImpl, Number(env.MODEL_DISCOVERY_TIMEOUT_MS || DEFAULT_TIMEOUT_MS));
  const res = await wrappedFetch(cfg.url, { method: 'GET', headers: cfg.headers });
  if (!res.ok) {
    const message = typeof res.text === 'function' ? await res.text() : `HTTP ${res.status}`;
    throw new Error(`${provider} models request failed: ${res.status} ${message}`);
  }
  const payload = await res.json();
  const candidates = cfg.normalize(payload)
    .filter(Boolean)
    .filter(item => item.id)
    .filter(item => !item.deprecated);

  const allowPreview = String(env.MODEL_DISCOVERY_ALLOW_PREVIEW || 'false') === 'true';
  const filtered = allowPreview ? candidates : candidates.filter(item => !item.preview);
  const sorted = filtered.sort(sortCandidates);

  return {
    provider,
    status: 'ok',
    sourceUrl: cfg.url,
    count: sorted.length,
    candidates: sorted
  };
}

async function discoverAllProviders(options = {}) {
  const env = options.env || process.env;
  const results = [];
  for (const provider of PROVIDERS) {
    try {
      results.push(await requestProviderModels(provider, options));
    } catch (error) {
      results.push({ provider, status: 'error', error: error.message, candidates: [] });
    }
  }
  const allCandidates = results.flatMap(result => result.candidates || []);
  const roles = buildRoleMap(allCandidates, env);
  const providers = {};
  for (const result of results) {
    providers[result.provider] = {
      status: result.status,
      count: result.count || 0,
      models: (result.candidates || []).map(item => ({
        id: item.id,
        createdAt: item.createdAt || null,
        preview: !!item.preview,
        roles: item.roles
      }))
    };
    if (result.error) providers[result.provider].error = result.error;
  }

  return {
    version: `discovery-${new Date().toISOString()}`,
    meta: {
      source: 'provider-api-discovery',
      generatedAt: new Date().toISOString(),
      allowPreview: String(env.MODEL_DISCOVERY_ALLOW_PREVIEW || 'false') === 'true',
      providersScanned: PROVIDERS
    },
    roles,
    providers
  };
}

module.exports = {
  PROVIDERS,
  requestProviderModels,
  discoverAllProviders,
  buildRoleMap,
  buildCandidate,
  classifyRole,
  sortCandidates
};
