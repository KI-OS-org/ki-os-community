/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
// (c) 2026 KI-OS.org by Ingo Schaffer und Kimba — AGPL-3.0-only
// @desc KIMBA Opinion Engine — stiller Trigger → Transcript-Analyse → kurze Meinung zurückflüstern
'use strict';

const axios = require('axios');

const OPINION_TRIGGER = () => (process.env.EARPIECE_OPINION_TRIGGER || 'hmmm').toLowerCase();
const LLM_MODEL       = process.env.EARPIECE_OPINION_MODEL || 'mistralai/codestral-2508';
const DRY_RUN         = () => process.env.EARPIECE_DRY_RUN === 'true';

const SYSTEM_PROMPT = `Du bist KIMBAs innere Stimme im Meeting.
Du hast alles mitgehört. Der Nutzer hat dich still getriggert.
Gib EINE direkte Meinung, Warnung oder Hintergrundinfo zu dem eben Gehörten.
Max. 12 Wörter. Kein "Ich". Keine Einleitung. Nur der Kern.
Wenn nichts Wichtiges erkennbar: antworte mit genau KIMBA_SCHWEIGT`;

/**
 * Prüft ob der transkribierte Text den stillen Trigger enthält
 * @param {string} text - Transkribierter Text
 * @returns {boolean}
 */
function isTrigger(text) {
  if (!text) return false;
  return text.toLowerCase().includes(OPINION_TRIGGER());
}

/**
 * Generiert eine kurze Meinung zum Meeting-Transcript
 * @param {string} transcript - Letzten N Segmente des Meetings
 * @param {Object} context - Meeting-Kontext (title, participants, emotionSummary)
 * @returns {Promise<string|null>} Meinung oder null wenn KIMBA schweigt
 */
async function generateOpinion(transcript, context = {}) {
  if (!transcript || transcript.trim().length < 10) {
    return null;
  }

  if (DRY_RUN()) {
    return 'Preisargument prüfen — Zahlen stimmen nicht.';
  }

  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error('OPENROUTER_API_KEY nicht konfiguriert');
  }

  const contextParts = [];
  if (context.title)         contextParts.push(`Meeting: ${context.title}`);
  if (context.emotionSummary) contextParts.push(`Stimmung: ${context.emotionSummary}`);
  const contextBlock = contextParts.length > 0 ? `\n[Kontext: ${contextParts.join(' · ')}]` : '';

  const userPrompt = `Eben gehört:${contextBlock}\n\n"${transcript}"`;

  try {
    const resp = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: LLM_MODEL,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user',   content: userPrompt }
        ],
        max_tokens: 40,
        temperature: 0.3
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 15000
      }
    );

    const text = resp.data.choices[0].message.content.trim();
    return text === 'KIMBA_SCHWEIGT' ? null : text;
  } catch (err) {
    throw new Error(`Opinion LLM Fehler: ${err.message}`);
  }
}

module.exports = { isTrigger, generateOpinion, OPINION_TRIGGER };
