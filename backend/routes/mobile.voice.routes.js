/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
// (c) 2026 KI-OS.org by Ingo Schaffer und Kimba — AGPL-3.0-only
'use strict';

const { spawn } = require('child_process');
const express  = require('express');
const axios    = require('axios');
const FormData = require('form-data');
const multer   = require('multer');
const { getEmotionProfile, getMoodProfile } = require('../services/voice/emotion.profiles');
const router   = express.Router();
const CARTESIA_BASE = 'https://api.cartesia.ai';
const CARTESIA_KEY      = () => process.env.CARTESIA_API_KEY || '';
const CARTESIA_MODEL    = () => process.env.CARTESIA_MODEL   || 'sonic-3';
const CARTESIA_VOICE_ID = () => process.env.CARTESIA_VOICE_ID || 'de07efe3-b309-418b-bdca-42827223efd2';
const GEMINI_KEY = () => process.env.GEMINI_API_KEY || '';
const GEMINI_VOICE = () => process.env.GEMINI_TTS_VOICE || 'Aoede';

function getVoiceId(lang, gender) {
  if (lang === 'en') {
    return gender === 'male'
      ? (process.env.CARTESIA_VOICE_EN_MALE   || 'dbfa416f-d5c3-4006-854b-235ef6bdf4fd')
      : (process.env.CARTESIA_VOICE_EN_FEMALE || 'f0377496-2708-4cc9-b2f8-1b7fdb5e1a2a');
  }
  return CARTESIA_VOICE_ID();
}

function truncateForSpeech(text, maxChars) {
  const limit = maxChars || Number(process.env.TTS_MAX_SPOKEN_CHARS) || 400;
  // Tags zählen nicht zur gesprochenen Länge — nur reinen Text messen
  const spokenOnly = text.replace(/<[^>]+>/g, '').replace(/\[[^\]]+\]/g, '').replace(/\s+/g, ' ').trim();
  if (spokenOnly.length <= limit) return { spoken: text, truncated: false };
  const sub = text.slice(0, limit);
  const lastDot = Math.max(sub.lastIndexOf('. '), sub.lastIndexOf('? '), sub.lastIndexOf('! '));
  const cutAt = lastDot > 80 ? lastDot + 1 : limit;
  return { spoken: text.slice(0, cutAt).trim(), truncated: true };
}

const upload  = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });
const OAI_KEY = () => process.env.OPENAI_API_KEY || '';
const OAI_BASE = 'https://api.openai.com/v1';
const GEMINI_TTS_URL = () => `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-tts-preview:generateContent?key=${encodeURIComponent(GEMINI_KEY())}`;

function streamPcmAsMp3(res, pcmBuffer) {
  return new Promise((resolve, reject) => {
    const ff = spawn('ffmpeg', ['-f', 's16le', '-ar', '24000', '-ac', '1', '-i', 'pipe:0', '-f', 'mp3', '-']);
    let settled = false;
    let stderr = '';

    function fail(err) {
      if (settled) return;
      settled = true;
      try { ff.kill('SIGKILL'); } catch (_) {}
      reject(err);
    }

    ff.on('error', (err) => fail(new Error(`ffmpeg failed to start: ${err.message}`)));
    ff.stdin.on('error', (err) => fail(new Error(`ffmpeg stdin error: ${err.message}`)));
    ff.stdout.on('error', (err) => fail(new Error(`ffmpeg stdout error: ${err.message}`)));
    ff.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    res.on('close', () => {
      if (!settled && !res.writableEnded) fail(new Error('client disconnected during audio stream'));
    });

    ff.on('close', (code) => {
      if (settled) return;
      if (code !== 0) return fail(new Error(`ffmpeg exited with code ${code}: ${stderr.trim()}`));
      settled = true;
      resolve();
    });

    res.setHeader('Content-Type', 'audio/mpeg');
    ff.stdout.pipe(res);
    ff.stdin.end(pcmBuffer);
  });
}

// POST /voice/transcribe
router.post('/voice/transcribe', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'audio field missing' });

    const mime = req.file.mimetype || 'audio/m4a';
    const ext  = mime.includes('mp4') || mime.includes('m4a') ? 'm4a'
               : mime.includes('webm') ? 'webm'
               : mime.includes('wav')  ? 'wav' : 'm4a';

    const form = new FormData();
    form.append('file', req.file.buffer, { filename: `voice.${ext}`, contentType: mime });
    form.append('model', 'whisper-1');
    form.append('language', 'de');

    const oaiRes = await axios.post(`${OAI_BASE}/audio/transcriptions`, form, {
      headers: { ...form.getHeaders(), Authorization: `Bearer ${OAI_KEY()}` },
      timeout: 30000,
    });
    res.json({ text: oaiRes.data.text || '' });
  } catch (err) {
    const msg = err.response?.data?.error?.message || err.message;
    res.status(500).json({ error: msg });
  }
});

// GET /api/voice/voices?lang=en
router.get('/voices', async (req, res) => {
  const lang = (req.query.lang || 'en').toLowerCase();
  if (!CARTESIA_KEY()) return res.status(503).json({ error: 'Cartesia not configured' });
  try {
    const r = await axios.get(`${CARTESIA_BASE}/voices`, {
      headers: { 'X-API-Key': CARTESIA_KEY(), 'Cartesia-Version': '2024-06-10' },
    });
    const voices = (r.data || [])
      .filter(v => v.language && v.language.startsWith(lang))
      .map(v => ({ id: v.id, name: v.name, gender: v.gender || 'unknown' }))
      .sort((a, b) => a.name.localeCompare(b.name));
    res.json(voices);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/voice/tts
router.post('/tts', express.json(), async (req, res) => {
  try {
    const { text, voice = 'nova', mood, lang = 'de', gender = 'female', voiceId } = req.body || {};
    const kiosMode = req.body.kiosMode || req.headers['x-kios-mode'] || 'koordination';
    // mood-spezifisches Profil hat Vorrang vor kiosMode
    const profile = mood ? getMoodProfile(mood) : getEmotionProfile(kiosMode);
    if (!text) return res.status(400).json({ error: 'text required' });

    // Nur Markdown-Formatierung entfernen, Gemini-Inline-Tags erhalten
    const clean = text.replace(/[*#_`]/g, '').trim();
    const { spoken, truncated } = truncateForSpeech(clean);
    const spokenText = truncated ? `${spoken} — More details in the document.` : spoken;
    const finalText = profile.tag ? `${profile.tag} ${spokenText}` : spokenText;

    if (GEMINI_KEY()) {
      const geminiRes = await axios.post(
        GEMINI_TTS_URL(),
        {
          contents: [{ parts: [{ text: finalText }] }],
          generationConfig: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: GEMINI_VOICE() }
              }
            }
          }
        },
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 30000,
        }
      );

      const pcmBase64 = geminiRes.data?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!pcmBase64) throw new Error('Gemini TTS returned no audio payload');
      const pcmBuffer = Buffer.from(pcmBase64, 'base64');
      await streamPcmAsMp3(res, pcmBuffer);
      return;
    }

    if (CARTESIA_KEY()) {
      const selectedVoiceId = voiceId || getVoiceId(lang, gender);
      const cartesiaRes = await axios.post(
        `${CARTESIA_BASE}/tts/bytes`,
        {
          model_id: CARTESIA_MODEL(),
          transcript: finalText,
          voice: { mode: 'id', id: selectedVoiceId },
          output_format: { container: 'mp3', encoding: 'mp3', sample_rate: 44100 },
          generation_config: { speed: profile.speed },
        },
        {
          headers: {
            'X-API-Key': CARTESIA_KEY(),
            'Cartesia-Version': '2024-06-10',
            'Content-Type': 'application/json',
          },
          responseType: 'stream',
          timeout: 30000,
        }
      );
      res.setHeader('Content-Type', 'audio/mpeg');
      cartesiaRes.data.pipe(res);
      return;
    }

    // Fallback: OpenAI TTS
    const oaiRes = await axios.post(
      `${OAI_BASE}/audio/speech`,
      { model: 'tts-1', input: finalText, voice, response_format: 'mp3' },
      { headers: { Authorization: `Bearer ${OAI_KEY()}`, 'Content-Type': 'application/json' },
        responseType: 'stream', timeout: 30000 }
    );
    res.setHeader('Content-Type', 'audio/mpeg');
    oaiRes.data.pipe(res);
  } catch (err) {
    if (!res.headersSent) res.status(500).json({ error: err.message });
  }
});

module.exports = router;
