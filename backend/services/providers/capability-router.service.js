/**
 * (c) 2026 KI-OS.org (v6.1) by Ingo Schaffer und Kimba
 * Datei: capability-router.service.js
 * Diese Datei bündelt das rollen- und capability-basierte Routing von KI-OS über die Pflicht-Provider.
 * Sie löst pro Aufgabe den besten Provider und das passende Modell für Chat, Research, Code, Websearch und Vision auf.
 */

'use strict';

const { loadModelCatalog, minimum } = require('./models-services');

const ROLE_PROVIDER_ENV = {
  default: 'ROUTER_DEFAULT_PROVIDER',
  fast: 'ROUTER_FAST_PROVIDER',
  reasoning: 'ROUTER_REASONING_PROVIDER',
  research: 'ROUTER_RESEARCH_PROVIDER',
  code: 'ROUTER_CODE_PROVIDER',
  low_cost: 'ROUTER_LOW_COST_PROVIDER',
  fallback: 'ROUTER_FALLBACK_PROVIDER',
  vision: 'ROUTER_VISION_PROVIDER',
  websearch: 'ROUTER_WEBSEARCH_PROVIDER'
};

const ROLE_DEFAULT_PROVIDERS = {
  default: 'openai',
  fast: 'gemini',
  reasoning: 'anthropic',
  research: 'openai',
  code: 'anthropic',
  low_cost: 'deepseek',
  fallback: 'openrouter',
  vision: 'openai',
  websearch: 'openai'
};

const ROLE_FALLBACKS = {
  websearch: ['research', 'default', 'fallback'],
  vision: ['default', 'fallback'],
  code: ['reasoning', 'default', 'fallback'],
  research: ['reasoning', 'default', 'fallback'],
  reasoning: ['default', 'fallback'],
  fast: ['default', 'fallback'],
  default: ['fallback']
};

const PROVIDER_DEFAULT_CAPABILITIES = {
  openai: { enabled: true, websearch: true, vision: true, reasoning: true, code: true, research: true, chat: true },
  anthropic: { enabled: true, websearch: true, vision: true, reasoning: true, code: true, research: true, chat: true },
  gemini: { enabled: true, websearch: true, vision: true, reasoning: true, code: true, research: true, chat: true },
  deepseek: { enabled: true, websearch: false, vision: false, reasoning: true, code: true, research: true, chat: true, low_cost: true },
  openrouter: { enabled: true, websearch: true, vision: true, reasoning: true, code: true, research: true, chat: true, fallback: true }
};

function normalizeProvider(provider) {
  const p = String(provider || '').toLowerCase().trim();
  if (p === 'google') return 'gemini';
  return p;
}

function envFlag(name, defaultValue = false, env = process.env) {
  const raw = env[name];
  if (raw == null || raw === '') return defaultValue;
  return String(raw).toLowerCase() === 'true';
}

function providerEnabled(provider, env = process.env) {
  const p = normalizeProvider(provider);
  const specific = env[`${p.toUpperCase()}_ENABLED`];
  if (specific != null && specific !== '') return String(specific).toLowerCase() === 'true';
  return !!PROVIDER_DEFAULT_CAPABILITIES[p]?.enabled;
}

function providerHasCapability(provider, capability, env = process.env) {
  const p = normalizeProvider(provider);
  const key = `${p.toUpperCase()}_${String(capability || '').toUpperCase()}_ENABLED`;
  const defaults = PROVIDER_DEFAULT_CAPABILITIES[p] || {};
  return providerEnabled(p, env) && envFlag(key, !!defaults[capability], env);
}

function getProviderCapabilitySnapshot(env = process.env) {
  const snapshot = {};
  for (const provider of Object.keys(PROVIDER_DEFAULT_CAPABILITIES)) {
    snapshot[provider] = {
      enabled: providerEnabled(provider, env),
      websearch: providerHasCapability(provider, 'websearch', env),
      vision: providerHasCapability(provider, 'vision', env),
      code: providerHasCapability(provider, 'code', env),
      reasoning: providerHasCapability(provider, 'reasoning', env),
      research: providerHasCapability(provider, 'research', env),
      chat: providerHasCapability(provider, 'chat', env)
    };
  }
  return snapshot;
}

function roleToCapability(role) {
  const r = String(role || 'default').toLowerCase();
  if (r === 'websearch') return 'websearch';
  if (r === 'vision') return 'vision';
  if (r === 'code') return 'code';
  if (r === 'research') return 'research';
  if (r === 'reasoning') return 'reasoning';
  if (r === 'low_cost') return 'low_cost';
  return 'chat';
}

function preferredProvidersForRole(role, env = process.env) {
  const r = String(role || 'default').toLowerCase();
  if (r === 'websearch') {
    const explicit = normalizeProvider(env.ROUTER_WEBSEARCH_PROVIDER || env.WEBSEARCH_PROVIDER || ROLE_DEFAULT_PROVIDERS.websearch);
    const priority = String(env.WEBSEARCH_PROVIDER_PRIORITY || '').split(',').map(v => normalizeProvider(v)).filter(Boolean);
    const fallback = normalizeProvider(env.ROUTER_WEBSEARCH_FALLBACK_PROVIDER || env.ROUTER_FALLBACK_PROVIDER || ROLE_DEFAULT_PROVIDERS.fallback);
    return [...new Set([explicit, ...priority, fallback].filter(Boolean))];
  }
  const explicit = normalizeProvider(env[ROLE_PROVIDER_ENV[r]] || env.ROUTER_DEFAULT_PROVIDER || ROLE_DEFAULT_PROVIDERS[r] || ROLE_DEFAULT_PROVIDERS.default);
  return [...new Set([explicit].filter(Boolean))];
}

function catalogRoleCandidates(catalog, role) {
  const roles = [...new Set([role, ...(ROLE_FALLBACKS[role] || [])])];
  const out = [];
  for (const r of roles) {
    const selection = catalog?.roles?.[r];
    if (selection?.model) {
      out.push({ role: r, provider: normalizeProvider(selection.provider), model: selection.model, source: selection.source || `catalog.roles.${r}` });
    }
  }
  return out;
}

function providerDefaultModel(catalog, provider) {
  const entry = catalog?.providers?.[provider];
  if (!entry) return null;
  return entry.default || Object.keys(entry.models || {})[0] || null;
}

function inferRoleFromTask(taskType, query = '') {
  const explicit = String(taskType || '').toLowerCase();
  if (explicit) {
    if (['websearch', 'search'].includes(explicit)) return 'websearch';
    if (['vision', 'image', 'multimodal'].includes(explicit)) return 'vision';
    if (['code', 'coding', 'developer'].includes(explicit)) return 'code';
    if (['research', 'analysis'].includes(explicit)) return 'research';
    if (['reasoning', 'planner', 'plan'].includes(explicit)) return 'reasoning';
    if (['fast', 'quick'].includes(explicit)) return 'fast';
    if (['cheap', 'low_cost', 'lowcost'].includes(explicit)) return 'low_cost';
  }
  const q = String(query || '').toLowerCase();
  if (/bild|image|vision|foto|screenshot/.test(q)) return 'vision';
  if (/code|api|programm|script|refactor|debug/.test(q)) return 'code';
  if (/websearch|suche|news|recherche|latest|aktuell/.test(q)) return 'websearch';
  if (/analys|reason|begründ|warum|strategie|plan/.test(q)) return 'reasoning';
  return 'default';
}

async function resolveCapabilityRoute(role, options = {}) {
  const env = options.env || process.env;
  const catalog = options.catalog || await loadModelCatalog(false, options);
  const normalizedRole = String(role || 'default').toLowerCase();
  const capability = roleToCapability(normalizedRole);
  const preferredProviders = preferredProvidersForRole(normalizedRole, env);
  const globalFallbackProvider = normalizeProvider(env.ROUTER_FALLBACK_PROVIDER || ROLE_DEFAULT_PROVIDERS.fallback || 'openrouter');
  const catalogCandidates = catalogRoleCandidates(catalog, normalizedRole);
  const candidates = [];

  for (const provider of preferredProviders) {
    const fromCatalog = catalogCandidates.find(item => item.provider === provider);
    if (fromCatalog) {
      candidates.push({ ...fromCatalog, provider, capability, priority: 'preferred+catalog' });
      continue;
    }
    const model = providerDefaultModel(catalog, provider);
    if (model) {
      candidates.push({ role: normalizedRole, provider, model, source: `catalog.providers.${provider}.default`, capability, priority: 'preferred+provider-default' });
    }
  }

  for (const item of catalogCandidates) {
    candidates.push({ ...item, capability, priority: 'catalog' });
  }

  const unique = [];
  for (const item of candidates) {
    if (!item?.provider || !item?.model) continue;
    const key = `${item.provider}:${item.model}`;
    if (!unique.find(existing => `${existing.provider}:${existing.model}` === key)) unique.push(item);
  }

  const resolved = unique.find(item => providerHasCapability(item.provider, capability, env));
  if (resolved) {
    return {
      role: normalizedRole,
      capability,
      provider: normalizeProvider(resolved.provider),
      model: resolved.model,
      source: resolved.source,
      catalogVersion: catalog?.version || catalog?.meta?.source || 'catalog'
    };
  }

  const fallbackProvider = globalFallbackProvider;
  const fallbackModel = providerDefaultModel(catalog, fallbackProvider) || minimum.roles.fallback.model;
  return {
    role: normalizedRole,
    capability,
    provider: fallbackProvider || 'openrouter',
    model: fallbackModel,
    source: 'fallback-provider',
    catalogVersion: catalog?.version || catalog?.meta?.source || 'catalog'
  };
}

module.exports = {
  resolveCapabilityRoute,
  inferRoleFromTask,
  providerHasCapability,
  providerEnabled,
  getProviderCapabilitySnapshot,
  normalizeProvider,
  roleToCapability,
  preferredProvidersForRole
};
