/**
 * @file    voice.executor.js
 * @desc    Routet transkribierten Text an Kimba-Chat und optional zurück via TTS.
 *          Schließt den Voice-Loop: Mikrofon → Whisper → Kimba → TTS.
 * @author  Ingo Schaffer <ingo@ki-os.org>
 * @coauthor Kimba <kimba@ki-os.org>
 * @license AGPL-3.0-only — https://www.gnu.org/licenses/agpl-3.0.html
 */

'use strict';

const axios  = require('../core/http.client');
const logger = require('../core/logger.service');

const BACKEND_CHAT_URL = `http://localhost:${process.env.PORT || 3000}/chat`;
const TTS_ENABLED      = process.env.VOICE_TTS_ENABLED !== 'false'; // default: true

/**
 * Sendet transkribierten Text an Kimba-Chat und gibt Antwort + TTS-Audio zurück.
 *
 * @param {object} params
 * @param {string} params.text       - Transkribierter Text
 * @param {string} [params.userId]   - User-ID für Kontext
 * @param {string} [params.voice]    - TTS-Stimme (alloy, echo, nova, ...)
 * @param {string} [params.sessionId]- Chat-Session-ID
 * @returns {Promise<{ success: boolean, reply: string, audioUrl?: string }>}
 */
async function execute({ text, userId = 'guest', voice = 'alloy', sessionId }) {
  logger.info('voice.executor.execute', { textLength: text.length, userId, ttsEnabled: TTS_ENABLED });

  // 1. Text an Kimba-Chat senden
  let reply = '';
  try {
    const chatRes = await axios.post(
      BACKEND_CHAT_URL,
      { message: text, userId, sessionId, source: 'voice' },
      { headers: { 'Content-Type': 'application/json', 'x-user-id': userId, 'x-role': 'user' }, timeout: 60000 }
    );
    reply = chatRes.data?.reply || chatRes.data?.answer || chatRes.data?.text || '';
  } catch (err) {
    logger.error('voice.executor.chat_error', { error: err.message });
    throw new Error(`Kimba-Chat nicht erreichbar: ${err.message}`);
  }

  if (!reply) {
    return { success: true, reply: '', audioUrl: null };
  }

  // 2. Antwort via TTS zu Audio (optional)
  let audioUrl = null;
  if (TTS_ENABLED && process.env.OPENAI_API_KEY) {
    try {
      const tts = require('../tts.service');
      const audioStream = await tts.stream(reply, voice);

      // Audio-Stream zu Base64 für den Response
      const chunks = [];
      await new Promise((resolve, reject) => {
        audioStream.on('data', chunk => chunks.push(chunk));
        audioStream.on('end', resolve);
        audioStream.on('error', reject);
      });
      const audioBase64 = Buffer.concat(chunks).toString('base64');
      audioUrl = `data:audio/mpeg;base64,${audioBase64}`;

      logger.info('voice.executor.tts_done', { replyLength: reply.length, audioBytes: Buffer.concat(chunks).length });
    } catch (err) {
      // TTS-Fehler ist nicht kritisch — Text-Antwort reicht
      logger.warn('voice.executor.tts_failed', { error: err.message });
    }
  }

  return { success: true, reply, audioUrl };
}

module.exports = { execute };
