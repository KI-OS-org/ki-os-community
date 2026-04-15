/**
 * @file    voice.controller.js
 * @desc    Request Handler für Voice Control Endpoints.
 *          POST /voice/transcribe — Audio (Base64) → Text (Whisper)
 *          POST /voice/chat       — Audio (Base64) → Kimba-Antwort + TTS
 * @author  Ingo Schaffer <ingo@ki-os.org>
 * @coauthor Kimba <kimba@ki-os.org>
 * @license AGPL-3.0-only — https://www.gnu.org/licenses/agpl-3.0.html
 */

'use strict';

const { transcribe } = require('./stt.service');
const { execute }    = require('./voice.executor');
const logger         = require('../core/logger.service');

/**
 * POST /voice/transcribe
 * Body: { audio: "<base64>", mimeType?: string, language?: string }
 * Response: { success, text, language, duration }
 */
async function handleTranscribe(body) {
  const { audio, mimeType = 'audio/webm', language = '' } = body || {};

  if (!audio) {
    return { statusCode: 400, body: { success: false, error: 'audio (Base64) ist erforderlich' } };
  }
  // Größencheck: Base64 von ~10 MB Audio ≈ 13 MB String
  if (audio.length > 14_000_000) {
    return { statusCode: 413, body: { success: false, error: 'Audio zu groß (max. ~10 MB)' } };
  }

  try {
    const result = await transcribe({ audio, mimeType, language });
    return { statusCode: 200, body: result };
  } catch (err) {
    logger.error('voice.controller.transcribe_error', { error: err.message });
    return { statusCode: 500, body: { success: false, error: err.message } };
  }
}

/**
 * POST /voice/chat
 * Body: { audio: "<base64>", mimeType?: string, language?: string, voice?: string, userId?: string, sessionId?: string }
 * Response: { success, transcript, reply, audioUrl? }
 */
async function handleVoiceChat(body, ctx) {
  const {
    audio,
    mimeType  = 'audio/webm',
    language  = '',
    voice     = 'alloy',
    userId    = (ctx && ctx.pki && ctx.pki.userId) || 'guest',
    sessionId
  } = body || {};

  if (!audio) {
    return { statusCode: 400, body: { success: false, error: 'audio (Base64) ist erforderlich' } };
  }

  try {
    // 1. Transkribieren
    const sttResult = await transcribe({ audio, mimeType, language });
    if (!sttResult.text) {
      return { statusCode: 200, body: { success: true, transcript: '', reply: '', audioUrl: null } };
    }

    // 2. An Kimba + TTS
    const execResult = await execute({ text: sttResult.text, userId, voice, sessionId });

    return {
      statusCode: 200,
      body: {
        success:    true,
        transcript: sttResult.text,
        language:   sttResult.language,
        reply:      execResult.reply,
        audioUrl:   execResult.audioUrl || null
      }
    };
  } catch (err) {
    logger.error('voice.controller.chat_error', { error: err.message });
    return { statusCode: 500, body: { success: false, error: err.message } };
  }
}

/**
 * Route dispatcher für alle /voice/* Pfade.
 */
async function handleVoiceRequest(path, method, body, ctx) {
  if (method !== 'POST') {
    return { statusCode: 405, body: { success: false, error: 'Method Not Allowed' } };
  }
  if (path === '/voice/transcribe') return handleTranscribe(body);
  if (path === '/voice/chat')       return handleVoiceChat(body, ctx);
  return { statusCode: 404, body: { success: false, error: `Voice route not found: ${path}` } };
}

module.exports = { handleVoiceRequest };
