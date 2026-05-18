/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
/**
 * (c) 2026 KI-OS.org (v6.1) by Ingo Schaffer und Kimba
 * Datei: websearch.service.js
 * Diese Datei bündelt native Websuche über die Pflicht-Provider von KI-OS und trennt Capability-Auswahl von der eigentlichen Suche.
 * Falls kein nativer Provider verfügbar ist, kann optional auf einen externen Search-Provider wie Brave zurückgefallen werden.
 * @license AGPL-3.0-only
 */

'use strict';

const OpenAI = require('./providers/openai.provider');
const Anthropic = require('./providers/anthropic.provider');
const Gemini = require('./providers/gemini.provider');
const OpenRouter = require('./providers/openrouter.provider');
const { resolveCapabilityRoute } = require('./providers/capability-router.service');

const NATIVE_PROVIDER_ORDER = ['openai', 'anthropic', 'gemini', 'openrouter'];


function getHttpClient() {
  return require('./core/http.client');
}

function envFlag(name, defaultValue = false) {
  const raw = process.env[name];
  if (raw == null || raw === '') return defaultValue;
  return String(raw).toLowerCase() === 'true';
}

function getProviderCapabilityMap() {
  return {
    openai: envFlag('OPENAI_WEBSEARCH_ENABLED', true),
    anthropic: envFlag('ANTHROPIC_WEBSEARCH_ENABLED', true),
    gemini: envFlag('GEMINI_WEBSEARCH_ENABLED', true),
    deepseek: envFlag('DEEPSEEK_WEBSEARCH_ENABLED', false),
    openrouter: envFlag('OPENROUTER_WEBSEARCH_ENABLED', true)
  };
}

function providerHasApiKey(provider) {
  switch (String(provider || '').toLowerCase()) {
    case 'openai': return !!process.env.OPENAI_API_KEY;
    case 'anthropic': return !!process.env.ANTHROPIC_API_KEY;
    case 'gemini': return !!process.env.GEMINI_API_KEY;
    case 'deepseek': return !!process.env.DEEPSEEK_API_KEY;
    case 'openrouter': return !!process.env.OPENROUTER_API_KEY;
    default: return false;
  }
}

function providerSupportsWebsearch(provider) {
  const capabilities = getProviderCapabilityMap();
  return !!capabilities[String(provider || '').toLowerCase()];
}

function getPreferredProvider() {
  const explicit = process.env.ROUTER_WEBSEARCH_PROVIDER || process.env.WEBSEARCH_PROVIDER || process.env.ROUTER_RESEARCH_PROVIDER;
  return String(explicit || 'openai').toLowerCase();
}

function getFallbackProviders() {
  const configured = String(process.env.WEBSEARCH_PROVIDER_PRIORITY || '').split(',').map(v => v.trim().toLowerCase()).filter(Boolean);
  const base = configured.length ? configured : NATIVE_PROVIDER_ORDER;
  const unique = [];
  for (const provider of [getPreferredProvider(), ...base, String(process.env.ROUTER_WEBSEARCH_FALLBACK_PROVIDER || '').toLowerCase()].filter(Boolean)) {
    if (!unique.includes(provider)) unique.push(provider);
  }
  return unique;
}

function normalizeSource(source, index) {
  const title = String(source?.title || source?.hostname || source?.domain || `Source ${index + 1}`).slice(0, 200);
  const url = String(source?.url || source?.uri || source?.link || '').trim();
  const description = String(source?.description || source?.snippet || source?.content || source?.text || '').slice(0, 500);
  return { id: index + 1, title, url, description };
}

function sanitizeSources(sources) {
  return (Array.isArray(sources) ? sources : [])
    .map(normalizeSource)
    .filter(item => /^https?:\/\//i.test(item.url));
}

async function runNativeProviderSearch(provider, query, count = 5) {
  switch (provider) {
    case 'openai':
      return OpenAI.webSearch({ query, count });
    case 'anthropic':
      return Anthropic.webSearch({ query, count });
    case 'gemini':
      return Gemini.webSearch({ query, count });
    case 'openrouter':
      return OpenRouter.webSearch({ query, count });
    default:
      throw new Error(`Provider ${provider} does not support native websearch`);
  }
}

async function runBraveFallback(query, count = 5) {
  const axios = getHttpClient();
  if (!axios || !process.env.BRAVE_API_KEY) {
    throw new Error('No native websearch provider configured and BRAVE_API_KEY missing');
  }

  const response = await axios.get('https://api.search.brave.com/res/v1/web/search', {
    headers: {
      Accept: 'application/json',
      'X-Subscription-Token': process.env.BRAVE_API_KEY
    },
    params: { q: query, count }
  });

  const rawResults = response?.data?.web?.results || [];
  const sources = sanitizeSources(rawResults.map(item => ({
    title: item.title,
    url: item.url,
    description: item.description
  })));

  return {
    ok: true,
    provider: 'brave',
    mode: 'external_fallback',
    sources,
    raw: response.data
  };
}

async function search(query, count = 5, options = {}) {
  const trimmed = String(query || '').trim();
  if (!trimmed) return { ok: false, provider: null, sources: [], reason: 'missing_query' };

  const explicitProvider = String(options.provider || '').toLowerCase();
  let routedProvider = '';
  if (!explicitProvider) {
    try {
      const route = await resolveCapabilityRoute('websearch', options);
      routedProvider = String(route?.provider || '').toLowerCase();
    } catch {}
  }
  const candidates = explicitProvider ? [explicitProvider] : Array.from(new Set([routedProvider, ...getFallbackProviders()].filter(Boolean)));
  const errors = [];

  for (const provider of candidates) {
    if (!providerSupportsWebsearch(provider)) continue;
    if (!providerHasApiKey(provider)) {
      errors.push(`${provider}:missing_api_key`);
      continue;
    }
    try {
      const result = await runNativeProviderSearch(provider, trimmed, count);
      return {
        ok: true,
        provider,
        mode: 'native',
        sources: sanitizeSources(result?.sources),
        answer: result?.answer || '',
        citations: Array.isArray(result?.citations) ? result.citations : [],
        raw: result?.raw
      };
    } catch (error) {
      errors.push(`${provider}:${error.message}`);
    }
  }

  try {
    const fallback = await runBraveFallback(trimmed, count);
    return { ...fallback, errors };
  } catch (error) {
    return {
      ok: false,
      provider: null,
      mode: 'none',
      sources: [],
      errors: [...errors, `brave:${error.message}`],
      reason: 'websearch_unavailable'
    };
  }
}

module.exports = {
  search,
  providerSupportsWebsearch,
  getProviderCapabilityMap,
  getFallbackProviders
};
