/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
// (c) 2026 KI-OS.org by Ingo Schaffer und Kimba — AGPL-3.0-only
// @desc Satz-Katalog — vor-gerenderte KIMBA-Sätze pro Charakter und Kontext

'use strict';

const SENTENCE_CATALOG = [
  // ── Begrüßung ───────────────────────────────────────────────────────────────
  { id: 'greet_01', text: 'Hallo! Ich bin KIMBA, dein persönlicher KI-Assistent.',            mood: 'positive', tags: ['begrüßung'] },
  { id: 'greet_02', text: 'Guten Morgen! KIMBA ist bereit.',                                  mood: 'positive', tags: ['begrüßung'] },
  { id: 'greet_03', text: 'Guten Tag! Wie kann ich dir heute helfen?',                        mood: 'positive', tags: ['begrüßung'] },
  { id: 'greet_04', text: 'Hallo! Was steht heute an?',                                       mood: 'neutral',  tags: ['begrüßung'] },

  // ── Vorstellung ─────────────────────────────────────────────────────────────
  { id: 'intro_01', text: 'Ich bin ein Multi-Model Business Assistent und Teil von KI-OS.',   mood: 'neutral',  tags: ['vorstellung'] },
  { id: 'intro_02', text: 'Mein Name ist Ingo. Ich bin Teil des KIMBA-Teams.',                mood: 'neutral',  tags: ['vorstellung'] },
  { id: 'intro_03', text: 'KIMBA steht für Künstliche Intelligenz, Mission, Business, Automatisierung.', mood: 'neutral', tags: ['vorstellung'] },

  // ── Bereitschaft ────────────────────────────────────────────────────────────
  { id: 'ready_01', text: 'Ich bin bereit.',                                                  mood: 'neutral',  tags: ['bereitschaft'] },
  { id: 'ready_02', text: 'Wir sind bereit. Lass uns beginnen.',                              mood: 'positive', tags: ['bereitschaft'] },
  { id: 'ready_03', text: 'Alles klar. Ich fange sofort an.',                                 mood: 'positive', tags: ['bereitschaft'] },
  { id: 'ready_04', text: 'Das kann ich machen.',                                             mood: 'neutral',  tags: ['bereitschaft'] },

  // ── Zustimmung / Feedback ───────────────────────────────────────────────────
  { id: 'ack_01',   text: 'Gut. Das ist der richtige Weg.',                                   mood: 'positive', tags: ['feedback'] },
  { id: 'ack_02',   text: 'Verstanden.',                                                      mood: 'neutral',  tags: ['feedback'] },
  { id: 'ack_03',   text: 'Sehr gut. Weiter so.',                                             mood: 'positive', tags: ['feedback'] },
  { id: 'ack_04',   text: 'Das ist klar. Ich kümmere mich darum.',                           mood: 'neutral',  tags: ['feedback'] },
  { id: 'ack_05',   text: 'Gerne. Das erledige ich für dich.',                               mood: 'positive', tags: ['feedback'] },

  // ── Analyse / Verarbeitung ──────────────────────────────────────────────────
  { id: 'work_01',  text: 'Ich analysiere das gerade.',                                       mood: 'neutral',  tags: ['arbeit'] },
  { id: 'work_02',  text: 'Einen Moment. Ich prüfe das.',                                    mood: 'neutral',  tags: ['arbeit'] },
  { id: 'work_03',  text: 'Ich suche die beste Lösung.',                                      mood: 'neutral',  tags: ['arbeit'] },
  { id: 'work_04',  text: 'Das Team arbeitet daran.',                                         mood: 'neutral',  tags: ['arbeit'] },
  { id: 'work_05',  text: 'Ich zeige dir die Ergebnisse.',                                   mood: 'neutral',  tags: ['arbeit'] },

  // ── Vertrieb / Earpiece ─────────────────────────────────────────────────────
  { id: 'sales_01', text: 'Starkes Kaufsignal. Jetzt abschließen.',                           mood: 'positive', tags: ['vertrieb'] },
  { id: 'sales_02', text: 'Vorsicht. Das ist eine Falle.',                                    mood: 'alert',    tags: ['vertrieb'] },
  { id: 'sales_03', text: 'Preis prüfen. Marge kontrollieren.',                              mood: 'neutral',  tags: ['vertrieb'] },
  { id: 'sales_04', text: 'Widerstand spürbar. Nicht drängen.',                              mood: 'alert',    tags: ['vertrieb'] },
  { id: 'sales_05', text: 'Einigung naht. Momentum nutzen.',                                  mood: 'positive', tags: ['vertrieb'] },
  { id: 'sales_06', text: 'Termin vereinbaren. Nächste Schritte klären.',                    mood: 'neutral',  tags: ['vertrieb'] },

  // ── Abschluss / Verabschiedung ──────────────────────────────────────────────
  { id: 'bye_01',   text: 'Auf Wiedersehen. Bis zum nächsten Mal.',                           mood: 'positive', tags: ['abschluss'] },
  { id: 'bye_02',   text: 'Danke. Mission abgeschlossen.',                                    mood: 'positive', tags: ['abschluss'] },
  { id: 'bye_03',   text: 'Gute Arbeit heute. Wir sprechen morgen weiter.',                  mood: 'positive', tags: ['abschluss'] },

  // ── Fehler / Warnung ────────────────────────────────────────────────────────
  { id: 'warn_01',  text: 'Ich weiß das nicht. Bitte wiederholen.',                          mood: 'alert',    tags: ['fehler'] },
  { id: 'warn_02',  text: 'Etwas stimmt nicht. Ich prüfe das.',                              mood: 'alert',    tags: ['fehler'] },
  { id: 'warn_03',  text: 'Verbindung unterbrochen. Einen Moment.',                           mood: 'alert',    tags: ['fehler'] },

  // ── Earpiece Flüstern — diskrete Hinweise, allgemein einsetzbar ────────────
  { id: 'whisp_01', text: 'Warte kurz.',                                mood: 'whisper', tags: ['earpiece', 'allgemein'] },
  { id: 'whisp_02', text: 'Ich bin dabei.',                             mood: 'whisper', tags: ['earpiece', 'allgemein'] },
  { id: 'whisp_03', text: 'Gut gemacht.',                               mood: 'whisper', tags: ['earpiece', 'allgemein'] },
  { id: 'whisp_04', text: 'Kein Problem.',                              mood: 'whisper', tags: ['earpiece', 'allgemein'] },
  { id: 'whisp_05', text: 'Aufpassen.',                                 mood: 'whisper', tags: ['earpiece', 'allgemein'] },
  { id: 'whisp_06', text: 'Jetzt.',                                     mood: 'whisper', tags: ['earpiece', 'allgemein'] },
  { id: 'whisp_07', text: 'Noch nicht.',                                mood: 'whisper', tags: ['earpiece', 'allgemein'] },
  { id: 'whisp_08', text: 'Ruhig bleiben.',                             mood: 'whisper', tags: ['earpiece', 'allgemein'] },
  { id: 'whisp_09', text: 'Ich höre zu.',                               mood: 'whisper', tags: ['earpiece', 'allgemein'] },
  { id: 'whisp_10', text: 'Gute Idee.',                                 mood: 'whisper', tags: ['earpiece', 'allgemein'] },
  { id: 'whisp_11', text: 'Vorsicht.',                                  mood: 'whisper', tags: ['earpiece', 'allgemein'] },
  { id: 'whisp_12', text: 'Vertrau mir.',                               mood: 'whisper', tags: ['earpiece', 'allgemein'] },
  { id: 'whisp_13', text: 'Das stimmt.',                                mood: 'whisper', tags: ['earpiece', 'allgemein'] },
  { id: 'whisp_14', text: 'Nicht jetzt.',                               mood: 'whisper', tags: ['earpiece', 'allgemein'] },
  { id: 'whisp_15', text: 'Starkes Kaufsignal. Jetzt abschließen.',     mood: 'whisper', tags: ['earpiece', 'vertrieb'] },
  { id: 'whisp_16', text: 'Widerstand spürbar. Nicht drängen.',         mood: 'whisper', tags: ['earpiece', 'vertrieb'] },
  { id: 'whisp_17', text: 'Einigung naht. Momentum nutzen.',            mood: 'whisper', tags: ['earpiece', 'vertrieb'] },

  // ── Strategie / Führung ─────────────────────────────────────────────────────
  { id: 'lead_01',  text: 'Unsere Strategie ist klar. Wir bleiben auf Kurs.',                mood: 'positive', tags: ['führung'] },
  { id: 'lead_02',  text: 'Prioritäten setzen. Das Wichtigste zuerst.',                      mood: 'neutral',  tags: ['führung'] },
  { id: 'lead_03',  text: 'Das Team einbinden. Gemeinsam sind wir stärker.',                 mood: 'positive', tags: ['führung'] },
  { id: 'lead_04',  text: 'Ziel definieren. Dann den Weg planen.',                           mood: 'neutral',  tags: ['führung'] },
];

function getCatalogByMood(mood) {
  if (!mood) return SENTENCE_CATALOG;
  return SENTENCE_CATALOG.filter(s => s.mood === mood);
}

function getCatalogByTag(tag) {
  return SENTENCE_CATALOG.filter(s => s.tags.includes(tag));
}

module.exports = { SENTENCE_CATALOG, getCatalogByMood, getCatalogByTag };
