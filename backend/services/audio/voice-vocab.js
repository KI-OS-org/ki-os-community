/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
// (c) 2026 KI-OS.org by Ingo Schaffer und Kimba — AGPL-3.0-only
// @desc Wortschatz-Katalog für Sprach-Charaktere — Grundlage für KI-generierte Sätze und Assembler

'use strict';

/**
 * BASIS-Wortschatz: 84 Kernwörter — gültig für ALLE Charaktere.
 * Erweiterter Wortschatz für ingo & aoede: VOCAB_EXTENDED (weitere ~45 Wörter).
 */
const VOCAB = [
  // Pronomen
  { word: 'Ich',    category: 'pronomen' },
  { word: 'Du',     category: 'pronomen' },
  { word: 'Er',     category: 'pronomen' },
  { word: 'Sie',    category: 'pronomen' },
  { word: 'Es',     category: 'pronomen' },
  { word: 'Wir',    category: 'pronomen' },
  { word: 'Ihr',    category: 'pronomen' },
  { word: 'mein',   category: 'pronomen' },
  { word: 'dein',   category: 'pronomen' },
  { word: 'unser',  category: 'pronomen' },

  // Hilfsverben + häufige Verben
  { word: 'bin',    category: 'verb' },
  { word: 'bist',   category: 'verb' },
  { word: 'ist',    category: 'verb' },
  { word: 'sind',   category: 'verb' },
  { word: 'habe',   category: 'verb' },
  { word: 'hat',    category: 'verb' },
  { word: 'kann',   category: 'verb' },
  { word: 'muss',   category: 'verb' },
  { word: 'wird',   category: 'verb' },
  { word: 'haben',  category: 'verb' },
  { word: 'sage',   category: 'verb' },
  { word: 'denke',  category: 'verb' },
  { word: 'mache',  category: 'verb' },
  { word: 'weiß',   category: 'verb' },
  { word: 'helfe',  category: 'verb' },
  { word: 'zeige',  category: 'verb' },

  // Artikel
  { word: 'der',    category: 'artikel' },
  { word: 'die',    category: 'artikel' },
  { word: 'das',    category: 'artikel' },
  { word: 'ein',    category: 'artikel' },
  { word: 'eine',   category: 'artikel' },
  { word: 'kein',   category: 'artikel' },
  { word: 'einen',  category: 'artikel' },
  { word: 'mir',    category: 'artikel' },
  { word: 'dir',    category: 'artikel' },

  // Adjektive
  { word: 'gut',      category: 'adjektiv' },
  { word: 'wichtig',  category: 'adjektiv' },
  { word: 'klar',     category: 'adjektiv' },
  { word: 'neu',      category: 'adjektiv' },
  { word: 'groß',     category: 'adjektiv' },
  { word: 'klein',    category: 'adjektiv' },
  { word: 'richtig',  category: 'adjektiv' },
  { word: 'bereit',   category: 'adjektiv' },
  { word: 'schnell',  category: 'adjektiv' },
  { word: 'einfach',  category: 'adjektiv' },

  // Substantive
  { word: 'Name',     category: 'nomen' },
  { word: 'Teil',     category: 'nomen' },
  { word: 'Team',     category: 'nomen' },
  { word: 'Preis',    category: 'nomen' },
  { word: 'Termin',   category: 'nomen' },
  { word: 'Vertrag',  category: 'nomen' },
  { word: 'Kunde',    category: 'nomen' },
  { word: 'Plan',     category: 'nomen' },
  { word: 'Ziel',     category: 'nomen' },
  { word: 'Zeit',     category: 'nomen' },
  { word: 'Weg',      category: 'nomen' },
  { word: 'Frage',    category: 'nomen' },
  { word: 'Antwort',  category: 'nomen' },

  // Verbindungswörter
  { word: 'und',    category: 'verbindung' },
  { word: 'oder',   category: 'verbindung' },
  { word: 'aber',   category: 'verbindung' },
  { word: 'weil',   category: 'verbindung' },
  { word: 'wenn',   category: 'verbindung' },
  { word: 'dann',   category: 'verbindung' },
  { word: 'jetzt',  category: 'verbindung' },
  { word: 'hier',   category: 'verbindung' },
  { word: 'auch',   category: 'verbindung' },
  { word: 'so',     category: 'verbindung' },
  { word: 'nicht',  category: 'verbindung' },
  { word: 'noch',   category: 'verbindung' },

  // Begrüßungen & Höflichkeit
  { word: 'Hallo',           category: 'begruessung' },
  { word: 'Danke',           category: 'begruessung' },
  { word: 'Bitte',           category: 'begruessung' },
  { word: 'Guten Morgen',    category: 'begruessung' },
  { word: 'Guten Tag',       category: 'begruessung' },
  { word: 'Auf Wiedersehen', category: 'begruessung' },
  { word: 'Gerne',           category: 'begruessung' },

  // KIMBA-spezifisch
  { word: 'KIMBA',      category: 'kimba' },
  { word: 'KI-OS',      category: 'kimba' },
  { word: 'Assistent',  category: 'kimba' },
  { word: 'Mission',    category: 'kimba' },
  { word: 'Strategie',  category: 'kimba' },
  { word: 'Modell',     category: 'kimba' },
  { word: 'Analyse',    category: 'kimba' },
];

/**
 * ERWEITERTER Wortschatz — nur für ingo & aoede.
 * Ermöglicht komplexere Sätze und KIMBA-Fachbegriffe.
 */
const VOCAB_EXTENDED = [
  // Erweiterte Verben
  { word: 'spreche',     category: 'verb' },
  { word: 'erkläre',     category: 'verb' },
  { word: 'analysiere',  category: 'verb' },
  { word: 'suche',       category: 'verb' },
  { word: 'finde',       category: 'verb' },
  { word: 'starte',      category: 'verb' },
  { word: 'stoppe',      category: 'verb' },
  { word: 'prüfe',       category: 'verb' },
  { word: 'sehe',        category: 'verb' },
  { word: 'höre',        category: 'verb' },

  // Erweiterte Adjektive
  { word: 'interessant',  category: 'adjektiv' },
  { word: 'komplex',      category: 'adjektiv' },
  { word: 'möglich',      category: 'adjektiv' },
  { word: 'notwendig',    category: 'adjektiv' },
  { word: 'verfügbar',    category: 'adjektiv' },
  { word: 'aktiv',        category: 'adjektiv' },
  { word: 'fertig',       category: 'adjektiv' },
  { word: 'offen',        category: 'adjektiv' },

  // Erweiterte Nomen
  { word: 'Projekt',      category: 'nomen' },
  { word: 'Problem',      category: 'nomen' },
  { word: 'Lösung',       category: 'nomen' },
  { word: 'Konzept',      category: 'nomen' },
  { word: 'Ergebnis',     category: 'nomen' },
  { word: 'Bericht',      category: 'nomen' },
  { word: 'Aufgabe',      category: 'nomen' },
  { word: 'Schritt',      category: 'nomen' },
  { word: 'Benutzer',     category: 'nomen' },
  { word: 'System',       category: 'nomen' },
  { word: 'Daten',        category: 'nomen' },
  { word: 'Prozess',      category: 'nomen' },

  // Zahlen
  { word: 'null',    category: 'zahl' },
  { word: 'eins',    category: 'zahl' },
  { word: 'zwei',    category: 'zahl' },
  { word: 'drei',    category: 'zahl' },
  { word: 'vier',    category: 'zahl' },
  { word: 'fünf',    category: 'zahl' },
  { word: 'sechs',   category: 'zahl' },
  { word: 'sieben',  category: 'zahl' },
  { word: 'acht',    category: 'zahl' },
  { word: 'neun',    category: 'zahl' },
  { word: 'zehn',    category: 'zahl' },

  // KIMBA-Fachbegriffe (erweitert)
  { word: 'Earpiece',   category: 'kimba' },
  { word: 'Briefing',   category: 'kimba' },
  { word: 'Sprint',     category: 'kimba' },
  { word: 'Dashboard',  category: 'kimba' },
  { word: 'Agent',      category: 'kimba' },
  { word: 'Workflow',   category: 'kimba' },
];

/** Zeichen für Charaktere mit erweitertem Wortschatz */
const EXTENDED_VOCAB_CHARACTERS = new Set(['ingo', 'aoede']);

/** Vollständiger Wortschatz für einen Charakter */
function getVocabFor(character) {
  if (EXTENDED_VOCAB_CHARACTERS.has(character)) return [...VOCAB, ...VOCAB_EXTENDED];
  return VOCAB;
}

/**
 * Satz-Templates für KI-Generierung.
 */
const SENTENCE_TEMPLATES = [
  'Mein Name ist {VALUE}.',
  'Ich bin {VALUE}.',
  'Ich bin ein {VALUE} und Teil von KIMBA.',
  'Hallo! Ich bin {VALUE}.',
  'Guten Morgen! Mein Name ist {VALUE}.',
  'Das ist {adjektiv}.',
  'Wir haben einen {nomen}.',
  'Der {nomen} ist {adjektiv}.',
  'Das kann ich machen.',
  'Ich helfe dir jetzt.',
  'Wir machen das einfach.',
  'Das ist klar.',
  'Ich bin bereit.',
  'Wir sind bereit.',
  'Das weiß ich nicht.',
  'Ich bin KIMBA, dein KI-OS Assistent.',
  'KIMBA ist bereit.',
  'Die Mission ist klar.',
  'Unsere Strategie ist gut.',
];

/**
 * Voice-Konfiguration pro Charakter.
 * provider: 'elevenlabs' | 'openai'
 * OpenAI voices: alloy | echo | fable | onyx | nova | shimmer
 * ElevenLabs: custom clone oder premade voice_id
 */
const CHARACTER_VOICES = {
  // Custom Clone (ElevenLabs)
  ingo:        { provider: 'elevenlabs', voiceId: process.env.ELEVENLABS_VOICE_ID_INGO || 'MOltvInZxbTWbS8QZqiB', label: 'Ingo (Clone)' },

  // Alle Charaktere: Gemini — einheitlicher Provider, individuelle Stimmen
  aoede:       { provider: 'gemini', voiceId: 'Aoede',    label: 'Aoede (KIMBA-Standard, warm)' },
  neutral:     { provider: 'gemini', voiceId: 'Aoede',    label: 'Aoede (neutral)' },
  flow:        { provider: 'gemini', voiceId: 'Aoede',    label: 'Aoede (fließend)' },
  greeting:    { provider: 'gemini', voiceId: 'Aoede',    label: 'Aoede (freundlich)' },
  synthesizer: { provider: 'gemini', voiceId: 'Kore',     label: 'Kore (analytisch-enthusiastisch)' },
  research:    { provider: 'gemini', voiceId: 'Kore',     label: 'Kore (sachlich, präzise)' },
  memory:      { provider: 'gemini', voiceId: 'Kore',     label: 'Kore (erinnert)' },
  planner:     { provider: 'gemini', voiceId: 'Charon',   label: 'Charon (tief, strukturiert)' },
  thinking:    { provider: 'gemini', voiceId: 'Charon',   label: 'Charon (nachdenklich)' },
  reviewer:    { provider: 'gemini', voiceId: 'Fenrir',   label: 'Fenrir (kritisch, klar)' },
  policy:      { provider: 'gemini', voiceId: 'Fenrir',   label: 'Fenrir (regelorientiert)' },
  supervisor:  { provider: 'gemini', voiceId: 'Puck',     label: 'Puck (energetisch, führend)' },
  execution:   { provider: 'gemini', voiceId: 'Puck',     label: 'Puck (aktiv, direkt)' },
  done:        { provider: 'gemini', voiceId: 'Aoede',    label: 'Aoede (abgeschlossen)' },
  error:       { provider: 'gemini', voiceId: 'Charon',   label: 'Charon (ernst, deutlich)' },
  laugh:       { provider: 'gemini', voiceId: 'Puck',     label: 'Puck (lebendig)' },
};

/** Dateiname aus Wort ableiten */
function wordToFilename(word) {
  return word
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[äöü]/g, (c) => ({ ä: 'ae', ö: 'oe', ü: 'ue' }[c] || c))
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9_-]/g, '')
    + '.mp3';
}

/** Pfad zu einer Vokabel-Datei */
function vocabPath(baseDir, character, word) {
  const path = require('path');
  return path.join(baseDir, 'de', character, 'vocab', wordToFilename(word));
}

module.exports = {
  VOCAB, VOCAB_EXTENDED, EXTENDED_VOCAB_CHARACTERS,
  getVocabFor, SENTENCE_TEMPLATES,
  CHARACTER_VOICES, wordToFilename, vocabPath,
};
