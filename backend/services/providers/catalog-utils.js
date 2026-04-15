/**
 * (c) 2026 KI-OS.org (v6.0) by Ingo Schaffer und Kimba
 * Datei: catalog-utils.js
 * Diese Datei enthält JavaScript-Logik für Runtime, Services, Tools oder Tests innerhalb des KI-OS AgentMesh.
 */

'use strict';
// FIX: CommonJS Syntax statt ESM
const { loadModelCatalog, refreshModelCatalog } = require('./models-services.js');

async function initCatalog() {
  return await loadModelCatalog(false);
}

function getCatalogSync() {
  // Hinweis: In Async Umgebungen schwierig, wir laden neu oder nutzen Cache in models-services
  return require('./models-services.js').minimum; 
}

async function ensureCatalog() {
  return await loadModelCatalog(false);
}

module.exports = {
    initCatalog,
    getCatalogSync,
    ensureCatalog
};