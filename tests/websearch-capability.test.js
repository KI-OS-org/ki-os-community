/**
 * (c) 2026 KI-OS.org (v6.1) by Ingo Schaffer und Kimba
 * Datei: websearch-capability.test.js
 * Diese Datei prüft die Provider-Fähigkeiten und das Routing der nativen Websuche im KI-OS.
 * Sie stellt sicher, dass Pflicht-Provider korrekt gewählt werden und dass externe Fallbacks nur bei Bedarf greifen.
 */

'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const Module = require('node:module');

const servicePath = path.resolve(__dirname, '../backend/services/websearch.service.js');
const openaiPath = path.resolve(__dirname, '../backend/services/providers/openai.provider.js');
const anthropicPath = path.resolve(__dirname, '../backend/services/providers/anthropic.provider.js');
const geminiPath = path.resolve(__dirname, '../backend/services/providers/gemini.provider.js');
const openrouterPath = path.resolve(__dirname, '../backend/services/providers/openrouter.provider.js');

function resetModules() {
  delete require.cache[servicePath];
  delete require.cache[openaiPath];
  delete require.cache[anthropicPath];
  delete require.cache[geminiPath];
  delete require.cache[openrouterPath];
}

function setProviderMocks() {
  require.cache[openaiPath] = {
    id: openaiPath,
    filename: openaiPath,
    loaded: true,
    exports: { webSearch: async ({ query }) => ({ answer: `openai:${query}`, sources: [{ title: 'OpenAI', url: 'https://openai.test', description: 'native' }] }) }
  };
  require.cache[anthropicPath] = {
    id: anthropicPath,
    filename: anthropicPath,
    loaded: true,
    exports: { webSearch: async ({ query }) => ({ answer: `anthropic:${query}`, sources: [{ title: 'Anthropic', url: 'https://anthropic.test', description: 'native' }] }) }
  };
  require.cache[geminiPath] = {
    id: geminiPath,
    filename: geminiPath,
    loaded: true,
    exports: { webSearch: async ({ query }) => ({ answer: `gemini:${query}`, sources: [{ title: 'Gemini', url: 'https://gemini.test', description: 'native' }] }) }
  };
  require.cache[openrouterPath] = {
    id: openrouterPath,
    filename: openrouterPath,
    loaded: true,
    exports: { webSearch: async ({ query }) => ({ answer: `openrouter:${query}`, sources: [{ title: 'OpenRouter', url: 'https://openrouter.test', description: 'native' }] }) }
  };
}

test('providerSupportsWebsearch classifies mandatory providers correctly', async () => {
  resetModules();
  setProviderMocks();
  const service = require(servicePath);
  assert.equal(service.providerSupportsWebsearch('openai'), true);
  assert.equal(service.providerSupportsWebsearch('anthropic'), true);
  assert.equal(service.providerSupportsWebsearch('gemini'), true);
  assert.equal(service.providerSupportsWebsearch('openrouter'), true);
  assert.equal(service.providerSupportsWebsearch('deepseek'), false);
  resetModules();
});

test('search uses preferred native provider with real provider adapter interface', async () => {
  resetModules();
  setProviderMocks();
  process.env.OPENAI_API_KEY = 'x';
  process.env.WEBSEARCH_PROVIDER = 'openai';
  const service = require(servicePath);
  const result = await service.search('latest retail ai news', 5);
  assert.equal(result.ok, true);
  assert.equal(result.provider, 'openai');
  assert.equal(result.mode, 'native');
  assert.equal(result.sources[0].url, 'https://openai.test');
  resetModules();
  delete process.env.OPENAI_API_KEY;
  delete process.env.WEBSEARCH_PROVIDER;
});

test('search falls back to Brave only when no native provider is available', async () => {
  resetModules();
  setProviderMocks();
  const originalLoad = Module._load;
  Module._load = function patched(request, parent, isMain) {
    if (request === 'axios') {
      return {
        get: async () => ({
          data: {
            web: {
              results: [
                { title: 'Brave result', url: 'https://brave.test/result', description: 'fallback search' }
              ]
            }
          }
        })
      };
    }
    return originalLoad.call(this, request, parent, isMain);
  };

  process.env.OPENAI_WEBSEARCH_ENABLED = 'false';
  process.env.ANTHROPIC_WEBSEARCH_ENABLED = 'false';
  process.env.GEMINI_WEBSEARCH_ENABLED = 'false';
  process.env.OPENROUTER_WEBSEARCH_ENABLED = 'false';
  process.env.BRAVE_API_KEY = 'x';

  try {
    const service = require(servicePath);
    const result = await service.search('latest commerce platform updates', 5);
    assert.equal(result.ok, true);
    assert.equal(result.provider, 'brave');
    assert.equal(result.mode, 'external_fallback');
    assert.equal(result.sources[0].url, 'https://brave.test/result');
  } finally {
    Module._load = originalLoad;
    resetModules();
    delete process.env.OPENAI_WEBSEARCH_ENABLED;
    delete process.env.ANTHROPIC_WEBSEARCH_ENABLED;
    delete process.env.GEMINI_WEBSEARCH_ENABLED;
    delete process.env.OPENROUTER_WEBSEARCH_ENABLED;
    delete process.env.BRAVE_API_KEY;
  }
});
