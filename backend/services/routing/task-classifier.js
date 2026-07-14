/**
 * KI-OS Community Edition — Core Infrastructure
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: Apache License 2.0
 * SPDX-License-Identifier: Apache-2.0
 */
/**
 * KI-OS — (C) 2026 Ingo Schaffer
 * https://ki-os.org
 * @license AGPL-3.0-only
 * @file backend/services/routing/task-classifier.js
 * @description Task Classifier — erkennt Task-Typ und empfiehlt optimales Modell
 */
"use strict";

const TASK_TYPES = {
  CODE: {
    keywords: [
      "programmier", "code", "script", "funktion", "klasse", "bug", "fix", "refactor",
      "implementier", "node.js", "python", "javascript", "typescript", "sql", "api", "endpoint"
    ],
    primary: { provider: 'openrouter', model: 'mistralai/devstral-2512' },
    fallback: { provider: 'openrouter', model: 'mistralai/codestral-2501' }
  },
  REASONING: {
    keywords: [
      "analysiere", "strategie", "entscheid", "plane", "bewerte", "vergleiche",
      "erkläre", "warum", "wie könnte", "was wenn", "vor- nachteile", "empfehlung"
    ],
    primary: { provider: 'anthropic', model: 'claude-sonnet-4-6' },
    fallback: { provider: 'local', model: 'loki-pro' }
  },
  DATA_ANALYSIS: {
    keywords: [
      "auswert", "berechne", "summe", "durchschnitt", "statistik", "tabelle",
      "csv", "excel", "daten", "zahlen", "grafik", "chart", "report", "bericht"
    ],
    primary: { provider: 'local', model: 'loki-pro' },
    fallback: { provider: 'anthropic', model: 'claude-sonnet-4-6' }
  },
  CREATIVE: {
    keywords: [
      "schreib", "erstelle text", "formulier", "email", "brief", "zusammenfassung",
      "headline", "beschreibung", "marketing", "social media", "content"
    ],
    primary: { provider: 'anthropic', model: 'claude-sonnet-4-6' },
    fallback: { provider: 'local', model: 'loki-pro' }
  },
  ROUTINE: {
    keywords: [], // Default
    primary: { provider: 'local', model: 'loki-mini' },
    fallback: { provider: 'local', model: 'loki-pro' }
  }
};

const TASK_TYPE_ORDER = [
  'reasoning',
  'code',
  'data_analysis',
  'creative',
  'routine'
];

function classify(text) {
  const lowerText = text.toLowerCase();
  let bestMatch = {
    taskType: 'routine',
    confidence: 0.0,
    primary: TASK_TYPES.ROUTINE.primary,
    fallback: TASK_TYPES.ROUTINE.fallback,
    matchedKeywords: []
  };
  let maxKeywords = 0;

  for (const type in TASK_TYPES) {
    const taskConfig = TASK_TYPES[type];
    const matchedKeywords = taskConfig.keywords.filter(keyword => lowerText.includes(keyword.toLowerCase()));

    if (matchedKeywords.length > 0) {
      let currentConfidence = 0.0;
      if (matchedKeywords.length === 1) {
        currentConfidence = 0.5;
      } else if (matchedKeywords.length === 2) {
        currentConfidence = 0.7;
      } else {
        currentConfidence = 0.9;
      }

      if (matchedKeywords.length > maxKeywords) {
        maxKeywords = matchedKeywords.length;
        bestMatch = {
          taskType: type.toLowerCase(),
          confidence: currentConfidence,
          primary: taskConfig.primary,
          fallback: taskConfig.fallback,
          matchedKeywords: matchedKeywords
        };
      } else if (matchedKeywords.length === maxKeywords) {
        // Tie-breaking based on TASK_TYPE_ORDER
        const currentBestTypeIndex = TASK_TYPE_ORDER.indexOf(bestMatch.taskType);
        const newTypeIndex = TASK_TYPE_ORDER.indexOf(type.toLowerCase());

        if (newTypeIndex < currentBestTypeIndex) {
          bestMatch = {
            taskType: type.toLowerCase(),
            confidence: currentConfidence,
            primary: taskConfig.primary,
            fallback: taskConfig.fallback,
            matchedKeywords: matchedKeywords
          };
        }
      }
    }
  }

  // If no keywords matched, ensure it's classified as routine with low confidence
  if (bestMatch.matchedKeywords.length === 0) {
    bestMatch.taskType = 'routine';
    bestMatch.confidence = 0.0;
    bestMatch.primary = TASK_TYPES.ROUTINE.primary;
    bestMatch.fallback = TASK_TYPES.ROUTINE.fallback;
  }

  return bestMatch;
}

module.exports = { classify };
