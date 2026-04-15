/**
 * (c) 2026 KI-OS.org (v6.0) by Ingo Schaffer und Kimba
 * Datei: catalog.js
 * DEPRECATED — war ESM in einem CommonJS-Projekt.
 * Verwende stattdessen: backend/services/providers/models-services.js
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
