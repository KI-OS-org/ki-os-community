/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
/**
 * KI-OS — (C) 2026 Ingo Schaffer und Kimba
 * https://ki-os.org
 * @license AGPL-3.0-only
 * @file backend/services/platform/service.router.js
 * @description Service-Router-Fassade (S8) — dünner Wrapper um den bereits bestehenden, produktiven smart-router.service.js.
 *              KEINE neue Routing-Logik, nur ein sauberer Einstiegspunkt + lesbare Aufbereitung für Service Platform/CLI/C-DECK.
 */

"use strict";

const smartRouter = require('../routing/smart-router.service');

/**
 * Routet eine Aufgabe und gibt ein für S8 aufbereitetes Ergebnis zurück
 * @param {string} text - Der Eingabetext
 * @param {Object} [options] - Optionale Routing-Parameter
 * @param {string} [options.context] - Kontextinformationen
 * @param {boolean} [options.forceLocal] - Erzwingt lokale Verarbeitung
 * @param {string} [options.forceProvider] - Erzwingt einen bestimmten Provider
 * @param {string} [options.economicProfile] - Wirtschaftliches Profil
 * @param {string} [options.quality] - Qualitätsstufe
 * @returns {Promise<Object>} Das aufbereitete Routing-Ergebnis
 */
async function routeTask(text, options = {}) {
  try {
    const decision = await smartRouter.route({
      text,
      context: options.context,
      forceLocal: options.forceLocal,
      forceProvider: options.forceProvider,
      economicProfile: options.economicProfile,
      quality: options.quality
    });

    return {
      routedTo: decision.provider,
      isLocal: decision.provider === 'local',
      model: decision.model,
      node: decision.node || null,
      reason: decision.reason,
      privacySensitive: decision.privacySensitive,
      taskType: decision.taskType,
      confidence: decision.confidence,
      blocked: false
    };
  } catch (err) {
    if (err.message && err.message.startsWith('PRIVACY_VIOLATION')) {
      return {
        routedTo: null,
        isLocal: false,
        model: null,
        node: null,
        reason: 'Sensible Daten erkannt, aber kein lokales Modell verfügbar — Anfrage aus Datenschutzgründen blockiert (kein Cloud-Fallback für sensible Daten)',
        privacySensitive: true,
        taskType: null,
        confidence: null,
        blocked: true
      };
    }
    // Alle anderen Fehler weiterwerfen
    throw err;
  }
}

/**
 * Routet eine Aufgabe und gibt eine menschenlesbare Erklärung zurück
 * @param {string} text - Der Eingabetext
 * @param {Object} [options] - Optionale Routing-Parameter
 * @returns {Promise<Object>} Das Ergebnis mit Erklärung
 */
async function explainRouting(text, options = {}) {
  const result = await routeTask(text, options);

  let explanation;
  if (result.blocked) {
    explanation = 'Blockiert: Sensible Daten erkannt, aber kein lokales Modell verfügbar';
  } else if (result.isLocal) {
    explanation = `Lokal geroutet an ${result.node || 'loki'} (${result.model}) — Grund: ${result.reason}`;
  } else {
    explanation = `An Cloud-Anbieter ${result.routedTo} (${result.model}) geroutet — Grund: ${result.taskType}`;
  }

  return {
    ...result,
    explanation
  };
}

module.exports = {
  routeTask,
  explainRouting
};
