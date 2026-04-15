/**
 * KI-OS — (C) 2026 Ingo Schaffer
 * https://ki-os.org
 */
'use strict';
const { loadModelCatalog, refreshModelCatalog, resolveAgentRuntimeModels, isDiscoveryEnabled } = require('../providers/models-services');
const { writeAudit } = require('./ui.audit');

async function getModelsPayload(force = false, ctx = {}) {
  const catalog = force ? await refreshModelCatalog() : await loadModelCatalog();
  const runtime = await resolveAgentRuntimeModels();
  return {
    success: true,
    discoveryEnabled: isDiscoveryEnabled(),
    runtime,
    catalog
  };
}

async function refreshModels(ctx = {}) {
  const payload = await getModelsPayload(true, ctx);
  writeAudit('ui.models.refresh', { type: 'models', force: true }, ctx);
  return payload;
}

module.exports = { getModelsPayload, refreshModels };
