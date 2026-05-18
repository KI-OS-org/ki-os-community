/**
 * KI-OS Community Edition — Core Infrastructure
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: Apache License 2.0
 * SPDX-License-Identifier: Apache-2.0
 */
/**
 * (c) 2026 KI-OS.org (v1.6.0) by Ingo Schaffer und Kimba
 * Datei: catalog.js
 * DEPRECATED — war ESM in einem CommonJS-Projekt.
 * Verwende stattdessen: backend/services/providers/models-services.js
 * @license AGPL-3.0-only
 */
'use strict';
const { loadModelCatalog, minimum } = require('./models-services.js');

async function getCatalog(force = false) {
  return loadModelCatalog(force);
}

function setTtlMinutes() { /* no-op — TTL via MODELS_CACHE_TTL_SEC env-var */ }
function clearCache() {
  require('./models-services.js').clearModelCatalogCache();
}

module.exports = { getCatalog, setTtlMinutes, clearCache, minimum };
