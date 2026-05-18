/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
/**
 * KI-OS — (C) 2026 Ingo Schaffer
 * https://ki-os.org
 * @license AGPL-3.0-only
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
