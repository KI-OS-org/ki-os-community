/**
 * (c) 2026 KI-OS.org (v6.1) by Ingo Schaffer und Kimba
 * Datei: model-discovery.service.test.js
 * Diese Datei prüft die dynamische Modell-Discovery über die Pflicht-Provider mit rein gemockten API-Antworten.
 * Sie stellt sicher, dass aktuelle Modelle gefiltert, normalisiert und pro Rolle sinnvoll ausgewählt werden.
 */

'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { discoverAllProviders } = require('../backend/services/providers/model.discovery.service');

function makeFetch(fixtures) {
  return async function fetch(url) {
    const key = Object.keys(fixtures).find(entry => url.startsWith(entry));
    if (!key) return { ok: false, status: 404, text: async () => 'not found' };
    return {
      ok: true,
      status: 200,
      json: async () => fixtures[key]
    };
  };
}

test('discovery builds role map from current provider APIs without preview models', async () => {
  const env = {
    OPENAI_API_KEY: 'x',
    OPENAI_API_BASE: 'https://openai.test/v1',
    ANTHROPIC_API_KEY: 'x',
    ANTHROPIC_API_BASE: 'https://anthropic.test',
    ANTHROPIC_VERSION: '2023-06-01',
    GEMINI_API_KEY: 'x',
    GEMINI_API_BASE: 'https://gemini.test',
    DEEPSEEK_API_KEY: 'x',
    DEEPSEEK_API_BASE: 'https://deepseek.test',
    OPENROUTER_API_KEY: 'x',
    OPENROUTER_API_BASE: 'https://openrouter.test/api/v1',
    MODEL_DISCOVERY_ALLOW_PREVIEW: 'false',
    ROUTER_DEFAULT_PROVIDER: 'openai',
    ROUTER_FAST_PROVIDER: 'gemini',
    ROUTER_REASONING_PROVIDER: 'anthropic',
    ROUTER_RESEARCH_PROVIDER: 'openai',
    ROUTER_CODE_PROVIDER: 'anthropic',
    ROUTER_LOW_COST_PROVIDER: 'deepseek',
    ROUTER_FALLBACK_PROVIDER: 'openrouter'
  };

  const fixtures = {
    'https://openai.test/v1/models': {
      data: [
        { id: 'gpt-5.4', created: 1770000000 },
        { id: 'gpt-5-mini', created: 1771000000 },
        { id: 'gpt-5.5-preview', created: 1772000000 }
      ]
    },
    'https://anthropic.test/v1/models': {
      data: [
        { id: 'claude-opus-4-6-20260115', created_at: '2026-01-15T10:00:00Z' },
        { id: 'claude-sonnet-4-6-20260116', created_at: '2026-01-16T10:00:00Z' }
      ]
    },
    'https://gemini.test/v1beta/models?key=x': {
      models: [
        { name: 'models/gemini-2.5-flash', displayName: 'Gemini 2.5 Flash' },
        { name: 'models/gemini-2.5-pro-preview', displayName: 'Gemini 2.5 Pro Preview' }
      ]
    },
    'https://deepseek.test/models': {
      data: [
        { id: 'deepseek-chat', created: 1760000000 },
        { id: 'deepseek-reasoner', created: 1765000000 }
      ]
    },
    'https://openrouter.test/api/v1/models': {
      data: [
        { id: 'openai/gpt-5.4', created_at: '2026-01-10T10:00:00Z' },
        { id: 'anthropic/claude-opus-4.6', created_at: '2026-01-14T10:00:00Z' }
      ]
    }
  };

  const catalog = await discoverAllProviders({ env, fetchImpl: makeFetch(fixtures) });
  assert.equal(catalog.roles.default.provider, 'openai');
  assert.equal(catalog.roles.default.model, 'gpt-5.4');
  assert.equal(catalog.roles.fast.provider, 'gemini');
  assert.equal(catalog.roles.fast.model, 'gemini-2.5-flash');
  assert.equal(catalog.roles.reasoning.provider, 'anthropic');
  assert.match(catalog.roles.reasoning.model, /claude/);
  assert.equal(catalog.roles.low_cost.provider, 'deepseek');
  assert.equal(catalog.roles.fallback.provider, 'openrouter');
  assert.equal(catalog.providers.openai.count, 2);
  assert.equal(catalog.providers.gemini.count, 1);
});

test('discovery skips providers without keys and reports status', async () => {
  const catalog = await discoverAllProviders({ env: {}, fetchImpl: async () => { throw new Error('should not call'); } });
  assert.equal(catalog.providers.openai.status, 'skipped');
  assert.equal(catalog.providers.anthropic.status, 'skipped');
  assert.deepEqual(catalog.roles, {});
});
