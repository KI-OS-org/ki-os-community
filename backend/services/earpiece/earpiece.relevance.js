/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
// (c) 2026 KI-OS.org by Ingo Schaffer und Kimba — AGPL-3.0-only
// @desc Relevanz-Engine für KIMBA Ohrwurm System — bewertet Transkripte und triggert Whisper
'use strict';

const { PARAVERBAL_SIGNALS, THRESHOLDS } = require('../../schemas/presence.schema.js');

// ─── Konstanten ──────────────────────────────────────────────────────────────
const WEIGHTS = {
  FACT_ERROR: 0.30,
  RISK_PATTERN: 0.25,
  ENTITIES: 0.20,
  USER_SIGNAL: 0.15,
  TOPIC_DRIFT: 0.10
};

const RISK_KEYWORDS = [
  'Preisfalle', 'Falle', 'versteckt', 'gebunden',
  'Laufzeit', 'automatisch verlängert', 'Kleingedruckte'
];

const ENTITY_REGEX = {
  YEAR: /\b20\d\d\b/g,
  COMPANY: /\b[A-Z][a-zA-Z]+(?:\s[A-Z][a-zA-Z]+)*\b/g
};

let evaluationInterval = null;
let interruptCount = 0;
let lastInterruptTime = null;

// ─── Hilfsfunktionen ─────────────────────────────────────────────────────────

/**
 * Extrahiert Zahlen aus einem Text
 * @param {string} text
 * @returns {number[]} Array von Zahlen
 */
function extractNumbers(text) {
  const matches = text.match(/\d[\d.,]+/g);
  return matches ? matches.map(num => parseFloat(num.replace(/,/g, '.'))) : [];
}

/**
 * Berechnet die Cosine-Ähnlichkeit zwischen zwei Texten
 * @param {string} text1
 * @param {string} text2
 * @returns {number} Ähnlichkeit (0–1)
 */
function cosineSimilarity(text1, text2) {
  const words1 = text1.toLowerCase().split(/\s+/);
  const words2 = text2.toLowerCase().split(/\s+/);

  const set1 = new Set(words1);
  const set2 = new Set(words2);

  const intersection = [...set1].filter(word => set2.has(word)).length;
  const union = set1.size + set2.size - intersection;

  return union === 0 ? 0 : intersection / union;
}

/**
 * Zählt Treffer von Keywords in Text
 * @param {string} text
 * @param {string[]} keywords
 * @returns {number} Anzahl der Treffer
 */
function countKeywordMatches(text, keywords) {
  return keywords.reduce((count, keyword) =>
    text.includes(keyword) ? count + 1 : count, 0);
}

/**
 * Prüft, ob Rate-Limit erreicht ist
 * @returns {boolean}
 */
function isRateLimited() {
  if (!lastInterruptTime) return false;

  const timeSinceLast = Date.now() - lastInterruptTime;
  const tenMinutes = 10 * 60 * 1000;

  if (timeSinceLast > tenMinutes) {
    interruptCount = 0;
    lastInterruptTime = null;
    return false;
  }

  return interruptCount >= THRESHOLDS.MAX_INTERRUPTS_PER_10M;
}

// ─── Hauptfunktionen ──────────────────────────────────────────────────────────

/**
 * Bewertet ein Transkript auf Relevanz
 * @param {string} transcript
 * @param {object} context
 * @param {string} context.meetingBrief
 * @param {string[]} context.knownEntities
 * @param {number} context.lastScore
 * @returns {{score: number, reasons: string[], shouldWhisper: boolean}}
 */
function scoreTranscript(transcript, context) {
  const reasons = [];
  let score = 0;

  // 1. Faktenfehler-Indikator
  const numbers = extractNumbers(transcript);
  if (numbers.length > 0 && context.knownEntities) {
    const factErrors = numbers.filter(num => {
      // Simplistischer Fakten-Check (in realer Implementierung komplexer)
      const knownNumbers = context.knownEntities
        .map(e => extractNumbers(e))
        .flat()
        .filter(n => !isNaN(n));

      return knownNumbers.some(knownNum =>
        Math.abs((num - knownNum) / knownNum) > 0.1
      );
    });

    if (factErrors.length > 0) {
      score += WEIGHTS.FACT_ERROR;
      reasons.push(`Faktenfehler erkannt: ${factErrors.join(', ')}`);
    }
  }

  // 2. Risiko-Pattern
  const riskMatches = countKeywordMatches(transcript, RISK_KEYWORDS);
  if (riskMatches > 0) {
    const riskScore = Math.min(riskMatches * 0.08, WEIGHTS.RISK_PATTERN);
    score += riskScore;
    reasons.push(`Risiko-Pattern erkannt (${riskMatches} Treffer)`);
  }

  // 3. Entitäten
  const yearMatches = transcript.match(ENTITY_REGEX.YEAR) || [];
  const companyMatches = transcript.match(ENTITY_REGEX.COMPANY) || [];

  const entityScore = Math.min(
    (yearMatches.length + companyMatches.length) * 0.10,
    WEIGHTS.ENTITIES
  );

  if (entityScore > 0) {
    score += entityScore;
    reasons.push(`Entitäten erkannt: ${[...yearMatches, ...companyMatches].join(', ')}`);
  }

  // 4. Nutzer-Signal
  const userSignalMatches = Object.values(PARAVERBAL_SIGNALS)
    .filter(signal => transcript.includes(signal));

  if (userSignalMatches.length > 0) {
    score += WEIGHTS.USER_SIGNAL;
    reasons.push(`Nutzer-Signale erkannt: ${userSignalMatches.join(', ')}`);
  }

  // 5. Topic-Drift
  if (context.lastScore && context.lastScore > 0) {
    const similarity = cosineSimilarity(
      transcript,
      context.meetingBrief || ''
    );

    if (similarity < 0.2) {
      score += WEIGHTS.TOPIC_DRIFT;
      reasons.push(`Topic-Drift erkannt (Ähnlichkeit: ${similarity.toFixed(2)})`);
    }
  }

  // Normalisieren des Scores (falls Summe > 1)
  score = Math.min(score, 1);

  return {
    score,
    reasons,
    shouldWhisper: score >= THRESHOLDS.RELEVANCE_MIN
  };
}

/**
 * Startet kontinuierliche Bewertung
 * @param {function} getTranscriptFn
 * @param {function} onWhisperTrigger
 * @param {number} [intervalMs=5000]
 */
function startContinuousEvaluation(getTranscriptFn, onWhisperTrigger, intervalMs = 5000) {
  if (evaluationInterval) {
    clearInterval(evaluationInterval);
  }

  let lastTranscript = '';
  let lastScore = 0;

  evaluationInterval = setInterval(async () => {
    if (isRateLimited()) {
      console.warn('Rate-Limit erreicht: Keine weiteren Interrupts in den nächsten 10 Minuten');
      return;
    }

    try {
      const transcript = await getTranscriptFn();
      if (!transcript || transcript === lastTranscript) return;

      const { score, reasons, shouldWhisper } = scoreTranscript(transcript, {
        meetingBrief: '', // In realer Implementierung mit Meeting-Kontext füllen
        knownEntities: [], // In realer Implementierung mit bekannten Entitäten füllen
        lastScore
      });

      lastScore = score;
      lastTranscript = transcript;

      if (shouldWhisper) {
        interruptCount++;
        lastInterruptTime = Date.now();
        onWhisperTrigger({ score, reasons });
      }
    } catch (error) {
      console.error('Fehler bei kontinuierlicher Bewertung:', error);
    }
  }, intervalMs);
}

/**
 * Stoppt die kontinuierliche Bewertung
 */
function stopEvaluation() {
  if (evaluationInterval) {
    clearInterval(evaluationInterval);
    evaluationInterval = null;
  }
}

module.exports = {
  scoreTranscript,
  startContinuousEvaluation,
  stopEvaluation
};
