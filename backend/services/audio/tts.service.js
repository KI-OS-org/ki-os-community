/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
// (c) 2026 KI-OS.org by Ingo Schaffer und Kimba — AGPL-3.0-only
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const axios = require('../core/http.client');
const audioCache = require('./audio-cache.service');

const GEMINI_KEY   = () => process.env.GEMINI_API_KEY || '';
const GEMINI_VOICE = () => process.env.GEMINI_TTS_VOICE || 'Aoede';
const GEMINI_TTS_URL = () => `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-tts-preview:generateContent?key=${encodeURIComponent(GEMINI_KEY())}`;
const OPENAI_KEY        = () => process.env.OPENAI_API_KEY || '';
const OPENAI_TTS_VOICE  = () => process.env.OPENAI_TTS_VOICE || 'nova';
const OPENAI_TTS_MODEL  = () => process.env.OPENAI_TTS_MODEL || 'tts-1';
const OPENAI_TTS_SYSTEM = () => process.env.OPENAI_TTS_SYSTEM_PROMPT ||
  'Du bist KIMBA, ein warmer und direkter KI-Partner. Sprich emotional, lebendig und natürlich.';
const TTS_PROVIDER      = () => process.env.TTS_PROVIDER || (OPENAI_KEY() ? 'gpt4o-audio' : 'gemini');

function _sha1(text) {
  return crypto.createHash('sha1').update(String(text).trim()).digest('hex');
}

function _normalizeText(text) {
  return String(text || '').replace(/[*#_`]/g, '').trim();
}

function _defaultFilePath(text, { lang, mood }) {
  const hash = _sha1(text).slice(0, 6);
  return path.join('DEMO', 'audio', lang, mood, `${hash}.mp3`);
}

function _ensureDir(filePath) {
  fs.mkdirSync(path.dirname(path.join(process.cwd(), filePath)), { recursive: true });
}

function _writeBuffer(filePath, buffer) {
  _ensureDir(filePath);
  fs.writeFileSync(path.join(process.cwd(), filePath), buffer);
}

function _pcmToMp3(pcmBuffer) {
  return new Promise((resolve, reject) => {
    const ff = spawn('ffmpeg', ['-f', 's16le', '-ar', '24000', '-ac', '1', '-i', 'pipe:0', '-f', 'mp3', '-']);
    const chunks = [];
    let stderr = '';
    let settled = false;

    function fail(err) {
      if (settled) return;
      settled = true;
      try { ff.kill('SIGKILL'); } catch {}
      reject(err);
    }

    ff.on('error', (err) => fail(new Error(`ffmpeg failed to start: ${err.message}`)));
    ff.stdin.on('error', (err) => fail(new Error(`ffmpeg stdin error: ${err.message}`)));
    ff.stdout.on('data', (chunk) => chunks.push(chunk));
    ff.stdout.on('error', (err) => fail(new Error(`ffmpeg stdout error: ${err.message}`)));
    ff.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    ff.on('close', (code) => {
      if (settled) return;
      if (code !== 0) return fail(new Error(`ffmpeg exited with code ${code}: ${stderr.trim()}`));
      settled = true;
      resolve(Buffer.concat(chunks));
    });

    ff.stdin.end(pcmBuffer);
  });
}

async function _renderOpenAI(text, { voice } = {}) {
  if (!OPENAI_KEY()) throw new Error('OPENAI_API_KEY fehlt');
  const https = require('https');
  const resolvedVoice = voice || OPENAI_TTS_VOICE();
  const model = OPENAI_TTS_MODEL();
  const isEmotional = model === 'gpt-4o-audio-preview';

  const body = isEmotional
    ? JSON.stringify({
        model,
        modalities: ['text', 'audio'],
        audio: { voice: resolvedVoice, format: 'mp3' },
        messages: [
          { role: 'system', content: OPENAI_TTS_SYSTEM() },
          { role: 'user',   content: text },
        ],
      })
    : JSON.stringify({ model, input: text, voice: resolvedVoice, response_format: 'mp3', speed: 1.0 });

  const apiPath = isEmotional ? '/v1/chat/completions' : '/v1/audio/speech';

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.openai.com', path: apiPath, method: 'POST',
      headers: { 'Authorization': `Bearer ${OPENAI_KEY()}`, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    }, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        if (res.statusCode !== 200) { reject(new Error(`OpenAI TTS HTTP ${res.statusCode}: ${buf.toString().slice(0,200)}`)); return; }
        if (isEmotional) {
          try {
            const json = JSON.parse(buf.toString());
            const b64 = json.choices?.[0]?.message?.audio?.data;
            if (!b64) { reject(new Error('gpt-4o-audio: kein Audio in Response')); return; }
            resolve(Buffer.from(b64, 'base64'));
          } catch (e) { reject(e); }
        } else {
          resolve(buf);
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function _renderGemini(text, { voice }) {
  if (!GEMINI_KEY()) throw new Error('GEMINI_API_KEY fehlt');

  const response = await axios.post(
    GEMINI_TTS_URL(),
    {
      contents: [{ parts: [{ text }] }],
      generationConfig: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voice || GEMINI_VOICE() },
          },
        },
      },
    },
    {
      headers: { 'Content-Type': 'application/json' },
      timeout: 30000,
    }
  );

  const pcmBase64 = response.data?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!pcmBase64) throw new Error('Gemini TTS returned no audio payload');
  return _pcmToMp3(Buffer.from(pcmBase64, 'base64'));
}

async function _renderAndStore(text, options = {}) {
  const mood = String(options.mood || 'neutral');
  const lang = String(options.lang || 'de');
  const voice = String(options.voice || GEMINI_VOICE());
  const character = String(options.character || 'synthesizer');
  const normalizedText = _normalizeText(text);
  const filePath = options.filePath || _defaultFilePath(normalizedText, { lang, mood });
  const provider = TTS_PROVIDER();
  const openaiVoice = ['nova', 'onyx', 'alloy', 'echo', 'fable', 'shimmer'].includes(voice)
    ? voice : OPENAI_TTS_VOICE();
  const buffer = (provider === 'openai' || provider === 'gpt4o-audio')
    ? await _renderOpenAI(normalizedText, { voice: openaiVoice })
    : await _renderGemini(normalizedText, { voice });

  _writeBuffer(filePath, buffer);
  const stored = await audioCache.store({
    text: normalizedText,
    mood,
    voice: (provider === 'openai' || provider === 'gpt4o-audio') ? openaiVoice : voice,
    provider,
    lang,
    filePath,
    character,
  });

  return { ...stored, text: normalizedText, mood, lang, voice, provider: 'gemini', filePath, buffer, character };
}

async function speak(text, { mood = 'neutral', lang = 'de', voice = 'Aoede', character = 'synthesizer' } = {}) {
  const normalizedText = _normalizeText(text);
  if (!normalizedText) throw new Error('tts.speak: text darf nicht leer sein');

  const hit = await audioCache.search(normalizedText, { mood, lang, character, limit: 1 });
  if (hit) {
    const absolutePath = path.join(process.cwd(), hit.filePath);
    if (fs.existsSync(absolutePath)) {
      const cachedBuffer = fs.readFileSync(absolutePath);

      if (hit.score >= 0.90) {
        await audioCache.incrementPlayCount(hit.id);
        return cachedBuffer;
      }

      if (hit.score >= 0.75) {
        if (!GEMINI_KEY()) {
          await audioCache.incrementPlayCount(hit.id);
          return cachedBuffer;
        }
        const liveBuffer = await _renderGemini(normalizedText, { voice });
        await audioCache.incrementPlayCount(hit.id);
        return Buffer.concat([cachedBuffer, liveBuffer]);
      }
    }
  }

  const rendered = await _renderAndStore(normalizedText, { mood, lang, voice, character });
  return rendered.buffer;
}

async function preload(phrases, options = {}) {
  const list = Array.isArray(phrases) ? phrases : [];
  const results = [];

  const delayMs = Number(options.delayMs || 2000);

  for (let i = 0; i < list.length; i++) {
    const phrase = list[i] || {};
    const filePath = phrase.filePath;

    // Skip wenn Datei bereits existiert
    if (filePath && fs.existsSync(path.join(process.cwd(), filePath))) {
      const info = {
        index: i, total: list.length,
        id: null, text: phrase.text, mood: phrase.mood,
        lang: phrase.lang, voice: phrase.voice, provider: 'cached',
        filePath, bytes: fs.statSync(path.join(process.cwd(), filePath)).size,
        stored: false, skipped: true,
      };
      results.push(info);
      if (typeof options.onProgress === 'function') options.onProgress(info);
      continue;
    }

    if (i > 0 && delayMs > 0) await new Promise(r => setTimeout(r, delayMs));

    const result = await _renderAndStore(phrase.text, {
      mood: phrase.mood || 'neutral',
      lang: phrase.lang || 'de',
      voice: phrase.voice || GEMINI_VOICE(),
      character: phrase.character || 'synthesizer',
      filePath: phrase.filePath,
    });

    const info = {
      index: i,
      total: list.length,
      id: result.id,
      text: result.text,
      mood: result.mood,
      lang: result.lang,
      voice: result.voice,
      provider: result.provider,
      filePath: result.filePath,
      bytes: result.buffer.length,
      stored: true,
    };
    results.push(info);

    if (typeof options.onProgress === 'function') {
      options.onProgress(info);
    }
  }

  return results;
}

module.exports = { speak, preload };
