/**
 * (c) 2026 KI-OS.org (v6.1) by Ingo Schaffer und Kimba
 * Datei: capability-router.test.js
 * Diese Datei testet das rollen- und capability-basierte Routing für Chat, Research, Code, Websearch und Vision.
 * Sie stellt sicher, dass KI-OS Provider und Modelle dynamisch und capability-konform auswählt.
 */

'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const routerPath = path.resolve(__dirname, '../backend/services/providers/capability-router.service.js');
const modelsPath = path.resolve(__dirname, '../backend/services/providers/models-services.js');

function freshRouter(catalog) {
  delete require.cache[routerPath];
  require.cache[modelsPath] = {
    id: modelsPath,
    filename: modelsPath,
    loaded: true,
    exports: {
      loadModelCatalog: async () => catalog,
      minimum: {
        roles: { fallback: { provider: 'openrouter', model: 'openrouter/auto' } }
      }
    }
  };
  return require(routerPath);
}

const catalog = {
  version: 'test-catalog',
  roles: {
    default: { provider: 'openai', model: 'gpt-5.4' },
    reasoning: { provider: 'anthropic', model: 'claude-opus-4-6-20260115' },
    research: { provider: 'openai', model: 'gpt-5.4' },
    code: { provider: 'anthropic', model: 'claude-opus-4-6-20260115' },
    vision: { provider: 'openai', model: 'gpt-5.4' },
    fallback: { provider: 'openrouter', model: 'openai/gpt-5.4' }
  },
  providers: {
    openai: { default: 'gpt-5.4', models: { 'gpt-5.4': ['default', 'research', 'vision'] } },
    anthropic: { default: 'claude-opus-4-6-20260115', models: { 'claude-opus-4-6-20260115': ['reasoning', 'code'] } },
    gemini: { default: 'gemini-3-flash', models: { 'gemini-3-flash': ['fast'] } },
    deepseek: { default: 'deepseek-reasoner', models: { 'deepseek-reasoner': ['low_cost', 'reasoning'] } },
    openrouter: { default: 'openai/gpt-5.4', models: { 'openai/gpt-5.4': ['fallback'] } }
  }
};

test('resolveCapabilityRoute picks native websearch provider from policy', async () => {
  process.env.ROUTER_WEBSEARCH_PROVIDER = 'anthropic';
  const router = freshRouter(catalog);
  const route = await router.resolveCapabilityRoute('websearch');
  assert.equal(route.provider, 'anthropic');
  assert.equal(route.capability, 'websearch');
  delete process.env.ROUTER_WEBSEARCH_PROVIDER;
  delete require.cache[modelsPath];
  delete require.cache[routerPath];
});

test('resolveCapabilityRoute picks code provider and model from catalog', async () => {
  process.env.ROUTER_CODE_PROVIDER = 'anthropic';
  const router = freshRouter(catalog);
  const route = await router.resolveCapabilityRoute('code');
  assert.equal(route.provider, 'anthropic');
  assert.equal(route.model, 'claude-opus-4-6-20260115');
  delete process.env.ROUTER_CODE_PROVIDER;
  delete require.cache[modelsPath];
  delete require.cache[routerPath];
});

test('resolveCapabilityRoute falls back when preferred provider lacks vision capability', async () => {
  process.env.ROUTER_VISION_PROVIDER = 'deepseek';
  process.env.DEEPSEEK_VISION_ENABLED = 'false';
  const router = freshRouter(catalog);
  const route = await router.resolveCapabilityRoute('vision');
  assert.equal(route.provider, 'openai');
  assert.equal(route.model, 'gpt-5.4');
  delete process.env.ROUTER_VISION_PROVIDER;
  delete process.env.DEEPSEEK_VISION_ENABLED;
  delete require.cache[modelsPath];
  delete require.cache[routerPath];
});
