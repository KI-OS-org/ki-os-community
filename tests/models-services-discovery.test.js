/**
 * (c) 2026 KI-OS.org (v6.1) by Ingo Schaffer und Kimba
 * Datei: models-services-discovery.test.js
 * Diese Datei testet die Einbindung der Discovery-Schicht in die zentrale Model-Registry.
 * Sie prüft Discovery-Priorität, Cache-Löschung und die Auflösung der AgentMesh-Rollenmodelle.
 */

'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const servicePath = require.resolve('../backend/services/providers/models-services');
const discoveryPath = require.resolve('../backend/services/providers/model.discovery.service');

function loadFresh(stubbedDiscovery) {
  delete require.cache[servicePath];
  require.cache[discoveryPath] = {
    id: discoveryPath,
    filename: discoveryPath,
    loaded: true,
    exports: stubbedDiscovery
  };
  return require(servicePath);
}

test('loadModelCatalog prefers API discovery when enabled', async () => {
  process.env.MODEL_DISCOVERY_ENABLED = 'true';
  const svc = loadFresh({
    discoverAllProviders: async () => ({
      version: 'discovery-test',
      meta: { source: 'provider-api-discovery' },
      roles: {
        default: { provider: 'openai', model: 'gpt-5.4' },
        reasoning: { provider: 'anthropic', model: 'claude-opus-4-6-20260115' }
      },
      providers: {}
    })
  });
  const doc = await svc.loadModelCatalog(true);
  assert.equal(doc.version, 'discovery-test');
  assert.equal(doc.roles.default.model, 'gpt-5.4');
  svc.clearModelCatalogCache();
  delete require.cache[discoveryPath];
  delete require.cache[servicePath];
});

test('resolveAgentRuntimeModels uses discovered roles unless env overrides exist', async () => {
  process.env.MODEL_DISCOVERY_ENABLED = 'true';
  delete process.env.AGENT_PLANNER_MODEL;
  delete process.env.AGENT_SYNTHESIZER_MODEL;
  const svc = loadFresh({
    discoverAllProviders: async () => ({
      version: 'discovery-test',
      meta: { source: 'provider-api-discovery' },
      roles: {
        default: { provider: 'openai', model: 'gpt-5.4' },
        reasoning: { provider: 'anthropic', model: 'claude-opus-4-6-20260115' }
      },
      providers: {}
    })
  });
  const models = await svc.resolveAgentRuntimeModels();
  assert.equal(models.plannerModel, 'claude-opus-4-6-20260115');
  assert.equal(models.synthesizerModel, 'gpt-5.4');
  process.env.AGENT_PLANNER_MODEL = 'forced-planner';
  const forced = await svc.resolveAgentRuntimeModels();
  assert.equal(forced.plannerModel, 'forced-planner');
  svc.clearModelCatalogCache();
  delete process.env.AGENT_PLANNER_MODEL;
  delete require.cache[discoveryPath];
  delete require.cache[servicePath];
});
