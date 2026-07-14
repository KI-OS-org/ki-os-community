/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
// (c) 2026 KI-OS.org by Ingo Schaffer und Kimba — AGPL-3.0-only
// @desc Audio-Katalog — kuratierte KIMBA-Earpiece-Standardphrasen
'use strict';

const CATALOG = [
  // Preisthemen
  { text: "Preis prüfen.", mood: "neutral", tags: ["preis"] },
  { text: "Marge kontrollieren.", mood: "neutral", tags: ["preis"] },
  { text: "Rabatt besprechen.", mood: "neutral", tags: ["preis"] },
  { text: "Budget überprüfen.", mood: "neutral", tags: ["preis"] },
  { text: "Kosten analysieren.", mood: "neutral", tags: ["preis"] },
  { text: "Versteckte Kosten?", mood: "alert", tags: ["preis", "vorsicht"] },
  { text: "Langfristig prüfen.", mood: "alert", tags: ["preis", "vorsicht"] },
  
  // Zustimmung/Ablehnung
  { text: "Erzwungene Zustimmung. Vorsicht.", mood: "alert", tags: ["zustimmung"] },
  { text: "Widerstand spürbar. Nicht drängen.", mood: "alert", tags: ["zustimmung"] },
  { text: "Überzeugung erkennbar. Gut.", mood: "positive", tags: ["zustimmung"] },
  { text: "Einigung naht.", mood: "positive", tags: ["zustimmung"] },
  { text: "Zweifel vorhanden.", mood: "alert", tags: ["zustimmung"] },
  
  // Nächste Schritte
  { text: "Nachfassen.", mood: "neutral", tags: ["nächste_schritte"] },
  { text: "Termin vereinbaren.", mood: "neutral", tags: ["nächste_schritte"] },
  { text: "Vertrag klären.", mood: "neutral", tags: ["nächste_schritte"] },
  { text: "Folgetermin planen.", mood: "neutral", tags: ["nächste_schritte"] },
  { text: "Details besprechen.", mood: "neutral", tags: ["nächste_schritte"] },
  
  // Vorsicht
  { text: "Vorsicht. Das ist eine Falle.", mood: "alert", tags: ["vorsicht"] },
  { text: "Hier nachfragen. Jetzt.", mood: "alert", tags: ["vorsicht"] },
  { text: "Zeit nehmen.", mood: "alert", tags: ["vorsicht"] },
  { text: "Konditionen hinterfragen.", mood: "alert", tags: ["vorsicht", "preis"] },

  // Positiv
  { text: "Starkes Kaufsignal.", mood: "positive", tags: ["positiv"] },
  { text: "Momentum. Jetzt abschließen.", mood: "positive", tags: ["positiv"] },
  { text: "Momentum nutzen.", mood: "positive", tags: ["positiv"] },
  { text: "Gute Position.", mood: "positive", tags: ["positiv"] },
  { text: "Vertrauen vorhanden.", mood: "positive", tags: ["positiv"] },
  
  // Neutral/Meta
  { text: "Pause einlegen.", mood: "neutral", tags: ["neutral"] },
  { text: "Zusammenfassen.", mood: "neutral", tags: ["neutral"] },
  { text: "Frage klären.", mood: "neutral", tags: ["neutral"] },
  { text: "Notizen prüfen.", mood: "neutral", tags: ["neutral"] },
  { text: "Pause. Klarheit schaffen.", mood: "neutral", tags: ["neutral"] },
  
  // Projekte
  { text: "Deadline im Blick.", mood: "neutral", tags: ["projekt"] },
  { text: "Ressourcen checken.", mood: "neutral", tags: ["projekt"] },
  { text: "Risiken abwägen.", mood: "alert", tags: ["projekt"] },
  
  // Führung
  { text: "Team einbinden.", mood: "neutral", tags: ["führung"] },
  { text: "Strategie überprüfen.", mood: "neutral", tags: ["führung"] },
  { text: "Prioritäten setzen.", mood: "neutral", tags: ["führung"] },
  { text: "Ziel definieren.", mood: "neutral", tags: ["führung"] },
  { text: "Verantwortung übernehmen.", mood: "positive", tags: ["führung"] },
  
  // Vertrieb
  { text: "Kunde im Fokus.", mood: "positive", tags: ["vertrieb"] },
  { text: "Optionen aufzeigen.", mood: "neutral", tags: ["vertrieb"] },
  { text: "Kompromiss suchen.", mood: "neutral", tags: ["vertrieb"] },
  { text: "Kunde versteht.", mood: "positive", tags: ["vertrieb"] },
  
  // Allgemein
  { text: "Flexibel bleiben.", mood: "neutral", tags: ["strategie"] },
  { text: "Innovation priorisieren.", mood: "positive", tags: ["strategie"] },
  { text: "Daten prüfen.", mood: "neutral", tags: ["analyse"] },
  { text: "Erfolg messen.", mood: "positive", tags: ["analyse"] }
];

function getCatalogByMood(mood) {
  if (!mood) return CATALOG;
  return CATALOG.filter(phrase => phrase.mood === mood);
}

function getCatalogForSeed() {
  return CATALOG;
}

module.exports = { CATALOG, getCatalogByMood, getCatalogForSeed };
