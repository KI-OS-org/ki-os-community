/**
 * KI-OS Community Edition — Core Infrastructure
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: Apache License 2.0
 * SPDX-License-Identifier: Apache-2.0
 */
/**
 * (c) 2026 KI-OS.org (v1.6.0) by Ingo Schaffer und Kimba
 * Datei: worker.registry.js
 * Diese Datei enthält JavaScript-Logik für Runtime, Services, Tools oder Tests innerhalb des KI-OS AgentMesh.
 * @license AGPL-3.0-only
 */

'use strict';

/**
 * Worker Registry - KI-OS Worker Layer V1
 * ========================================
 * Definiert alle verfügbaren Worker mit ihren Capabilities und Modell-Präferenzen.
 * Jeder Worker ist auf bestimmte Aufgaben spezialisiert.
 */

const WORKER_DEFINITIONS = {
  // ========================================
  // EXCEL WORKER
  // ========================================
  excel: {
    worker_id: 'excel-v1',
    worker_type: 'excel',
    version: '1.0',
    description: 'Excel/Tabellen-Generierung, KPI-Reports, Datenanalyse in XLSX-Format',
    preferred_models: ['gemini-3.1-pro', 'claude-sonnet-4-6', 'gpt-5.4'],
    fallback_models: ['gemini-2.0-flash', 'deepseek-chat'],
    capabilities: [
      'generate_file',         // XLSX-Dateien erzeugen
      'table_transform',       // Tabellen transformieren
      'formula_engine',        // Excel-Formeln generieren
      'kpi_generation',        // KPI-Reports erstellen
      'chart_generation',      // Charts/Diagramme
      'pivot_tables',          // Pivot-Tabellen
      'data_validation'        // Datenvalidierung
    ],
    supported_input_formats: ['text', 'csv', 'json', 'xlsx'],
    output_format: 'xlsx',
    constraints: {
      max_tokens: 16000,
      max_rows: 10000,
      style: 'technical'
    }
  },

  // ========================================
  // CODE WORKER
  // ========================================
  code: {
    worker_id: 'code-v1',
    worker_type: 'code',
    version: '1.0',
    description: 'Multi-File Code-Generierung, Refactoring, Dependency-Analyse',
    preferred_models: ['claude-sonnet-4-6', 'gpt-5.4', 'deepseek-chat'],
    fallback_models: ['gemini-2.0-flash', 'claude-haiku-4-5-20251001'],
    capabilities: [
      'multi_file',            // Mehrere Dateien gleichzeitig
      'zip_output',            // ZIP-Archiv-Generierung
      'dependency_analysis',   // Abhängigkeiten analysieren
      'refactor',              // Code-Refactoring
      'documentation',         // Code-Dokumentation
      'test_generation',       // Test-Generierung
      'linting',               // Code-Qualität prüfen
      'security_scan'          // Security-Analyse
    ],
    supported_input_formats: ['text', 'code', 'zip', 'url'],
    output_format: 'zip',
    constraints: {
      max_tokens: 32000,
      max_files: 50,
      style: 'technical'
    }
  },

  // ========================================
  // PDF WORKER
  // ========================================
  pdf: {
    worker_id: 'pdf-v1',
    worker_type: 'pdf',
    version: '1.0',
    description: 'PDF-Verarbeitung: Lesen, Extrahieren, Zusammenfassen, Generieren',
    preferred_models: ['claude-sonnet-4-6', 'gpt-5.4'],
    fallback_models: ['gemini-3.1-pro', 'gemini-2.0-flash'],
    capabilities: [
      'read_pdf',              // PDF einlesen
      'summarize',             // Zusammenfassen
      'extract_tables',        // Tabellen extrahieren
      'extract_images',        // Bilder extrahieren
      'generate_pdf',          // PDF generieren
      'ocr',                   // Text-Erkennung
      'metadata_extraction',   // Metadaten extrahieren
      'pdf_merge',             // PDFs zusammenführen
      'pdf_split'              // PDFs aufteilen
    ],
    supported_input_formats: ['pdf', 'image', 'text'],
    output_format: 'pdf',
    constraints: {
      max_tokens: 24000,
      max_pages: 100,
      style: 'formal'
    }
  },

  // ========================================
  // PPT WORKER
  // ========================================
  ppt: {
    worker_id: 'ppt-v1',
    worker_type: 'ppt',
    version: '1.0',
    description: 'PowerPoint-Präsentationen: Design, Outline-to-PPT, PPTX-Export',
    preferred_models: ['claude-sonnet-4-6', 'gpt-5.4', 'gemini-3.1-pro'],
    fallback_models: ['gemini-2.0-flash', 'claude-haiku-4-5-20251001'],
    capabilities: [
      'slide_design',          // Folien-Design
      'outline_to_ppt',        // Gliederung → PPT
      'pptx_export',           // PPTX-Export
      'template_application',  // Templates anwenden
      'image_integration',     // Bilder einbinden
      'chart_integration',     // Charts einbinden
      'speaker_notes',         // Notizen generieren
      'animation'              // Animationen
    ],
    supported_input_formats: ['text', 'json', 'markdown', 'pdf'],
    output_format: 'pptx',
    constraints: {
      max_tokens: 16000,
      max_slides: 50,
      style: 'creative'
    }
  },

  // ========================================
  // DATA WORKER
  // ========================================
  data: {
    worker_id: 'data-v1',
    worker_type: 'data',
    version: '1.0',
    description: 'Datenanalyse, CSV-Merge, Forecasting, Analytics',
    preferred_models: ['gemini-3.1-pro', 'claude-sonnet-4-6', 'deepseek-chat'],
    fallback_models: ['gemini-2.0-flash', 'deepseek-reasoner'],
    capabilities: [
      'csv_merge',             // CSV-Dateien zusammenführen
      'dataframe_ops',         // DataFrame-Operationen
      'forecast',              // Vorhersagen
      'analytics',             // Datenanalyse
      'statistics',            // Statistiken
      'correlation',           // Korrelationsanalyse
      'visualization',         // Datenvisualisierung
      'data_cleaning'          // Daten-Bereinigung
    ],
    supported_input_formats: ['csv', 'json', 'xlsx', 'text'],
    output_format: 'json',
    constraints: {
      max_tokens: 20000,
      max_rows: 50000,
      style: 'technical'
    }
  },

  // ========================================
  // RESEARCH WORKER
  // ========================================
  research: {
    worker_id: 'research-v1',
    worker_type: 'research',
    version: '1.0',
    description: 'Web-Recherche, Multi-Source-Suche, PDF-Suche, Zusammenfassungen',
    preferred_models: ['gpt-5.4', 'claude-sonnet-4-6', 'gemini-3.1-pro'],
    fallback_models: ['gemini-2.0-flash', 'claude-haiku-4-5-20251001'],
    capabilities: [
      'web_search',            // Web-Suche
      'pdf_search',            // PDF-Suche
      'multi_source_summary',  // Multi-Source-Zusammenfassung
      'fact_checking',         // Fakten prüfen
      'citation',              // Zitationen
      'deep_research',         // Tiefenrecherche
      'trend_analysis',        // Trend-Analyse
      'competitor_analysis'    // Wettbewerbsanalyse
    ],
    supported_input_formats: ['text', 'url', 'pdf'],
    output_format: 'json',
    constraints: {
      max_tokens: 32000,
      max_sources: 20,
      style: 'neutral'
    }
  },

  // ========================================
  // BROWSER WORKER
  // ========================================
  browser: {
    worker_id: 'browser-v1',
    worker_type: 'browser',
    version: '1.0',
    description: 'Browser-Automation: Navigieren, Extrahieren, Download (Claude Computer Use)',
    preferred_models: ['claude-sonnet-4-6', 'gpt-5.4'],
    fallback_models: ['claude-sonnet-4-6'],
    capabilities: [
      'navigate',              // Seiten navigieren
      'extract',               // Inhalte extrahieren
      'download',              // Dateien herunterladen
      'screenshot',            // Screenshots
      'form_fill',             // Formulare ausfüllen
      'click',                 // Klicken
      'scroll',                // Scrollen
      'wait'                   // Warten
    ],
    supported_input_formats: ['url', 'text'],
    output_format: 'json',
    constraints: {
      max_tokens: 16000,
      max_actions: 50,
      style: 'technical'
    }
  },

  // ========================================
  // MULTI WORKER
  // ========================================
  multi: {
    worker_id: 'multi-v1',
    worker_type: 'multi',
    version: '1.0',
    description: 'Multi-Worker-Orchestrierung, Verification, Tool-Selection',
    preferred_models: ['gpt-5.4', 'claude-sonnet-4-6'],
    fallback_models: ['gemini-2.0-flash', 'claude-haiku-4-5-20251001'],
    capabilities: [
      'orchestrate_workers',   // Worker orchestrieren
      'verification',          // Ergebnisse verifizieren
      'tool_selection',        // Tools auswählen
      'task_decomposition',    // Aufgaben zerlegen
      'result_synthesis',      // Ergebnisse zusammenführen
      'quality_control'        // Qualitätskontrolle
    ],
    supported_input_formats: ['text', 'json'],
    output_format: 'json',
    constraints: {
      max_tokens: 32000,
      max_workers: 5,
      style: 'neutral'
    }
  },



  // ========================================
  // DESKTOP WORKER
  // ========================================
  desktop: {
    worker_id: 'desktop-v1',
    worker_type: 'desktop',
    version: '1.0',
    description: 'Lokale Desktop-Beobachtung und kontrollierte Desktop-Aktionen',
    preferred_models: ['gpt-5.4', 'claude-sonnet-4-6'],
    fallback_models: ['gemini-2.0-flash'],
    capabilities: [
      'desktop_status',
      'desktop_observe',
      'desktop_screenshot',
      'desktop_action',
      'desktop_stop',
      'user_guard',
      'session_lock'
    ],
    supported_input_formats: ['text', 'json'],
    output_format: 'json',
    constraints: {
      max_actions: 20,
      style: 'technical'
    }
  },
  // ========================================
  // CHAT WORKER (Default/Fallback)
  // ========================================
  chat: {
    worker_id: 'chat-v1',
    worker_type: 'chat',
    version: '1.0',
    description: 'Standard-Chat ohne spezielle Worker-Funktionen',
    preferred_models: ['gpt-5.4', 'claude-sonnet-4-6', 'gemini-3.1-pro'],
    fallback_models: ['gemini-2.0-flash', 'deepseek-chat'],
    capabilities: [
      'conversation',          // Normale Konversation
      'question_answering',    // Fragen beantworten
      'explanation',           // Erklärungen
      'brainstorming'          // Brainstorming
    ],
    supported_input_formats: ['text'],
    output_format: 'text',
    constraints: {
      max_tokens: 16000,
      style: 'neutral'
    }
  }
};

/**
 * Gibt alle Worker-Definitionen zurück
 */
function getAllWorkers() {
  return WORKER_DEFINITIONS;
}

/**
 * Gibt einen spezifischen Worker zurück
 */
function getWorker(workerType) {
  const type = String(workerType || 'chat').toLowerCase();
  return WORKER_DEFINITIONS[type] || WORKER_DEFINITIONS.chat;
}

/**
 * Prüft, ob ein Worker eine bestimmte Capability hat
 */
function hasCapability(workerType, capability) {
  const worker = getWorker(workerType);
  return worker.capabilities.includes(capability);
}

/**
 * Gibt alle Worker zurück, die eine bestimmte Capability haben
 */
function getWorkersByCapability(capability) {
  const result = [];
  for (const [type, worker] of Object.entries(WORKER_DEFINITIONS)) {
    if (worker.capabilities.includes(capability)) {
      result.push({ type, worker });
    }
  }
  return result;
}

/**
 * Gibt bevorzugte Modelle für einen Worker zurück
 */
function getPreferredModels(workerType) {
  const worker = getWorker(workerType);
  return [...worker.preferred_models, ...worker.fallback_models];
}

/**
 * Gibt das beste Modell für einen Worker basierend auf Verfügbarkeit zurück
 */
function getBestModel(workerType, availableProviders = []) {
  const worker = getWorker(workerType);
  const allModels = [...worker.preferred_models, ...worker.fallback_models];

  // Wenn keine Provider-Filter angegeben, nimm das erste preferred Model
  if (!availableProviders || availableProviders.length === 0) {
    return allModels[0];
  }

  // Finde erstes Modell, das zu einem verfügbaren Provider passt
  for (const model of allModels) {
    const modelLower = model.toLowerCase();
    for (const provider of availableProviders) {
      const providerLower = provider.toLowerCase();
      if (
        (providerLower === 'openai' && modelLower.includes('gpt')) ||
        (providerLower === 'anthropic' && modelLower.includes('claude')) ||
        (providerLower === 'gemini' && modelLower.includes('gemini')) ||
        (providerLower === 'deepseek' && modelLower.includes('deepseek'))
      ) {
        return model;
      }
    }
  }

  // Fallback: erstes preferred Model
  return allModels[0];
}

/**
 * Validiert ob Input-Format unterstützt wird
 */
function supportsInputFormat(workerType, format) {
  const worker = getWorker(workerType);
  return worker.supported_input_formats.includes(format);
}

/**
 * Gibt Worker-Statistiken zurück
 */
function getWorkerStats() {
  const stats = {
    total: Object.keys(WORKER_DEFINITIONS).length,
    by_type: {},
    total_capabilities: 0
  };

  for (const [type, worker] of Object.entries(WORKER_DEFINITIONS)) {
    stats.by_type[type] = {
      capabilities: worker.capabilities.length,
      preferred_models: worker.preferred_models.length,
      supported_formats: worker.supported_input_formats.length
    };
    stats.total_capabilities += worker.capabilities.length;
  }

  return stats;
}

module.exports = {
  // Hauptfunktionen
  getAllWorkers,
  getWorker,
  getPreferredModels,
  getBestModel,

  // Capability-Management
  hasCapability,
  getWorkersByCapability,

  // Validierung
  supportsInputFormat,

  // Statistiken
  getWorkerStats,

  // Raw Access (für Tests/Debugging)
  WORKER_DEFINITIONS
};
