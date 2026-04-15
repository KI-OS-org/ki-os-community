/**
 * @file    stt.service.js
 * @desc    Speech-to-Text via OpenAI Whisper API.
 *          Empfängt Audio als Base64-String, ruft Whisper auf, gibt Text zurück.
 *          Fallback: Gibt Hinweis auf Browser SpeechRecognition wenn kein API-Key.
 * @author  Ingo Schaffer <ingo@ki-os.org>
 * @coauthor Kimba <kimba@ki-os.org>
 * @license AGPL-3.0-only — https://www.gnu.org/licenses/agpl-3.0.html
 */

'use strict';

const FormData = require('form-data');
const axios    = require('../core/http.client');
const logger   = require('../core/logger.service');

const WHISPER_MODEL   = process.env.STT_MODEL    || 'whisper-1';
const WHISPER_TIMEOUT = Number(process.env.STT_TIMEOUT_MS || 30000);

/**
 * Transkribiert Audio zu Text via OpenAI Whisper.
 *
 * @param {object} params
 * @param {string} params.audio      - Base64-kodiertes Audio
 * @param {string} params.mimeType   - MIME-Type (z.B. "audio/webm", "audio/mp4")
 * @param {string} [params.language] - Sprache ISO-639-1 (de, en, ...) oder leer für Auto-Detect
 * @returns {Promise<{ success: boolean, text: string, language?: string, duration?: number }>}
 */
async function transcribe({ audio, mimeType = 'audio/webm', language = '' }) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY nicht gesetzt — Whisper nicht verfügbar');
  }
  if (!audio) {
    throw new Error('audio (Base64) ist erforderlich');
  }

  const startedAt = Date.now();

  // Base64 → Buffer → FormData
  const buffer = Buffer.from(audio, 'base64');
  const ext    = mimeTypeToExt(mimeType);
  const form   = new FormData();
  form.append('file', buffer, { filename: `audio.${ext}`, contentType: mimeType });
  form.append('model', WHISPER_MODEL);
  form.append('response_format', 'verbose_json');
  if (language) form.append('language', language);

  logger.info('stt.transcribe.start', { mimeType, language: language || 'auto', bytes: buffer.length });

  const response = await axios.post(
    'https://api.openai.com/v1/audio/transcriptions',
    form,
    {
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        ...form.getHeaders()
      },
      timeout: WHISPER_TIMEOUT
    }
  );

  const data     = response.data;
  const text     = String(data.text || '').trim();
  const duration = Date.now() - startedAt;

  logger.info('stt.transcribe.done', { textLength: text.length, duration, detectedLanguage: data.language });

  return {
    success:  true,
    text,
    language: data.language || language || 'unknown',
    duration,
    model:    WHISPER_MODEL
  };
}

function mimeTypeToExt(mimeType) {
  const map = {
    'audio/webm':  'webm',
    'audio/mp4':   'mp4',
    'audio/ogg':   'ogg',
    'audio/wav':   'wav',
    'audio/mpeg':  'mp3',
    'audio/mp3':   'mp3',
  };
  return map[String(mimeType || '').toLowerCase()] || 'webm';
}

module.exports = { transcribe };
