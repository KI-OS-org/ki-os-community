/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
// (c) 2026 KI-OS.org by Ingo Schaffer und Kimba — AGPL-3.0-only
// @desc Whisper-Engine für KIMBA Ohrwurm System — generiert und spielt Flüster-Texte via TTS (Gemini/Aoede)
'use strict';

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { AUDIO_ISOLATION_RULE } = require('../../schemas/presence.schema');
const ttsService = require('../audio/tts.service');
const audioCache = require('../audio/audio-cache.service');

// ─── Konstanten ──────────────────────────────────────────────────────────────
const WHISPER_PROMPT = `Du sitzt als stille Kollegin im Meeting. Du wirst NICHT direkt angesprochen.
Du flüsterst NUR wenn du etwas Wichtiges erkennst.
Max. 8 Wörter. Kein "Ich". Kein Präambel. Direkter Kern.
Wenn nichts Wichtiges: antworte mit genau: KIMBA_SCHWEIGT`;

const WHISPER_TTS = {
  voice: process.env.GEMINI_TTS_VOICE || 'Aoede',
  outputVolume: parseFloat(process.env.EARPIECE_TTS_VOLUME || '0.9'),
  maxWords: parseInt(process.env.EARPIECE_MAX_WORDS || '8'),
};

// Mood-spezifische Flüster-Stile — Gemini/Aoede interpretiert Sprechstil aus Text-Präfix
const WHISPER_PREFIXES = {
  neutral:  'Say calmly and clearly, as a soft intimate whisper: ',
  whisper:  'Say in a very quiet whisper, close and intimate: ',
  alert:    'Say with quiet urgency, like an important warning whispered right next to the ear: ',
  positive: 'Say warmly with a hint of a smile, as a gentle confident whisper: ',
};

// Schlüsselwörter für automatische Mood-Erkennung
const ALERT_WORDS  = ['achtung', 'vorsicht', 'falle', 'risiko', 'warnung', 'problem', 'stopp', 'gefahr', 'nein'];
const POSITIVE_WORDS = ['stark', 'jetzt', 'momentum', 'überzeugt', 'gewinn', 'ja', 'gut', 'perfekt', 'chance', 'top'];

function detectMood(text) {
  const lower = (text || '').toLowerCase();
  if (ALERT_WORDS.some(w => lower.includes(w)))   return 'alert';
  if (POSITIVE_WORDS.some(w => lower.includes(w))) return 'positive';
  return 'neutral';
}

const AUDIO_DIR = path.join(__dirname, '../../../data/earpiece/audio');

// ─── Initialisierung ─────────────────────────────────────────────────────────
if (!fs.existsSync(AUDIO_DIR)) {
  fs.mkdirSync(AUDIO_DIR, { recursive: true });
}

// ─── Hilfsfunktionen ─────────────────────────────────────────────────────────

/**
 * Rendert Text via Gemini TTS direkt (ohne LanceDB-Cache-Schicht)
 * @param {string} text
 * @returns {Promise<Buffer>} MP3-Buffer
 */
async function _renderGeminiDirect(text) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY nicht konfiguriert');

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${encodeURIComponent(apiKey)}`;
  const resp = await axios.post(url, {
    contents: [{ parts: [{ text }] }],
    generationConfig: {
      responseModalities: ['AUDIO'],
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: WHISPER_TTS.voice } } }
    }
  }, { headers: { 'Content-Type': 'application/json' }, timeout: 30000 });

  const pcmB64 = resp.data?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!pcmB64) throw new Error('Gemini TTS: kein Audio in Response');

  const pcm = Buffer.from(pcmB64, 'base64');
  return new Promise((resolve, reject) => {
    const ff = spawn('ffmpeg', [
      '-f', 's16le', '-ar', '24000', '-ac', '1', '-i', 'pipe:0',
      '-f', 'mp3', '-'
    ], { stdio: ['pipe', 'pipe', 'pipe'] });
    const chunks = [];
    ff.stdout.on('data', c => chunks.push(c));
    ff.on('close', () => resolve(Buffer.concat(chunks)));
    ff.on('error', reject);
    ff.stdin.write(pcm);
    ff.stdin.end();
  });
}

/**
 * Validiert und kürzt Text auf maxWords
 * @param {string} text
 * @returns {string}
 */
function validateWordCount(text) {
  if (!text) return '';

  const words = text.split(/\s+/);
  if (words.length <= WHISPER_TTS.maxWords) {
    return text;
  }

  return words.slice(0, WHISPER_TTS.maxWords).join(' ');
}

/**
 * Generiert Whisper-Text via LLM
 * @param {string} transcript
 * @param {object} context
 * @param {boolean} isReactive
 * @param {string} [userQuery]
 * @returns {Promise<string|null>}
 */
async function generateWhisperText(transcript, context, isReactive, userQuery) {
  const llmModel = process.env.EARPIECE_LLM_MODEL || 'mistralai/codestral-2508';
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY nicht konfiguriert');
  }

  const prompt = isReactive
    ? `Antworte auf die Frage: "${userQuery}". Max. 15 Wörter. Kein "Ich".`
    : WHISPER_PROMPT;

  const messages = [
    { role: 'system', content: prompt },
    { role: 'user', content: `Transkript: ${transcript}` }
  ];

  if (context && Object.keys(context).length > 0) {
    messages.push({
      role: 'system',
      content: `Kontext: ${JSON.stringify(context)}`
    });
  }

  try {
    const response = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: llmModel,
        messages,
        max_tokens: isReactive ? 30 : 20,
        temperature: 0.3,
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const text = response.data.choices[0].message.content.trim();

    if (text === 'KIMBA_SCHWEIGT') {
      return null;
    }

    return validateWordCount(text);
  } catch (error) {
    console.error('Fehler beim LLM-Call:', error.response?.data || error.message);
    throw new Error('LLM-Aufruf fehlgeschlagen');
  }
}

/**
 * Erzeugt TTS-Audio via Gemini/Aoede und gibt Dateipfad zurück
 * @param {string} text
 * @param {string} [mood]
 * @returns {Promise<string>}
 */
async function playTTS(text, mood) {
  // HARDRULE-Check
  if (AUDIO_ISOLATION_RULE.TTS_OUTPUT_MUST_BE_LOCAL !== true) {
    throw new Error('HARDRULE VERLETZT: TTS nicht über Meeting-Kanal');
  }

  if (process.env.EARPIECE_DRY_RUN === 'true') {
    return path.join(AUDIO_DIR, `earpiece_mock_${Date.now()}.wav`);
  }

  const effectiveMood = mood || detectMood(text);

  // ── 1. Cache-Lookup (semantische Ähnlichkeit) ────────────────────────────────
  const CACHE_THRESHOLD = parseFloat(process.env.AUDIO_CACHE_SCORE_THRESHOLD || '0.92');
  try {
    const hit = await audioCache.search(text, { mood: effectiveMood, lang: 'de' });
    if (hit && hit.score >= CACHE_THRESHOLD) {
      const absPath = path.isAbsolute(hit.filePath)
        ? hit.filePath
        : path.resolve(process.cwd(), hit.filePath);
      if (fs.existsSync(absPath)) {
        audioCache.incrementPlayCount(hit.id).catch(() => {});
        await new Promise((resolve, reject) => {
          const player = spawn('afplay', ['-v', String(WHISPER_TTS.outputVolume), absPath]);
          player.on('close', resolve);
          player.on('error', reject);
        });
        return absPath;
      }
    }
  } catch {}

  // ── 2. Gemini TTS (Cache Miss) ───────────────────────────────────────────────
  try {
    const whisperText = (WHISPER_PREFIXES[effectiveMood] || WHISPER_PREFIXES.neutral) + text;
    const buffer = await _renderGeminiDirect(whisperText);

    const timestamp = Date.now();
    const filename = `earpiece_${timestamp}.mp3`;
    const filepath = path.join(AUDIO_DIR, filename);
    fs.writeFileSync(filepath, buffer);

    // ── 3. In Cache speichern (Fire-and-Forget) ──────────────────────────────
    audioCache.store({
      text,
      mood: effectiveMood,
      voice: WHISPER_TTS.voice,
      provider: 'gemini',
      lang: 'de',
      filePath: filepath,
      character: 'earpiece',
    }).catch(() => {});

    // ── 4. Abspielen (HARDRULE: nur lokales Gerät) ───────────────────────────
    await new Promise((resolve, reject) => {
      const player = spawn('afplay', ['-v', String(WHISPER_TTS.outputVolume), filepath]);
      player.on('close', resolve);
      player.on('error', reject);
    });

    return filepath;
  } catch (error) {
    console.error('Fehler beim TTS-Call (Gemini/Aoede):', error.message);
    throw new Error('TTS-Aufruf fehlgeschlagen');
  }
}

// ─── Hauptfunktionen ──────────────────────────────────────────────────────────

/**
 * Proaktive Whisper-Generierung (von Relevanz-Engine getriggert)
 * @param {string} transcript
 * @param {object} context
 * @param {string[]} reasons
 * @returns {Promise<{whispered: boolean, text: string, audioFile: string|null}>}
 */
async function whisperProactive(transcript, context, reasons) {
  try {
    const text = await generateWhisperText(transcript, context, false);

    if (!text) {
      return {
        whispered: false,
        text: 'KIMBA_SCHWEIGT',
        audioFile: null,
      };
    }

    const audioFile = await playTTS(text);

    return {
      whispered: true,
      text,
      audioFile,
    };
  } catch (error) {
    console.error('Fehler bei proaktiver Whisper-Generierung:', error);
    return {
      whispered: false,
      text: 'Fehler bei Whisper-Generierung',
      audioFile: null,
    };
  }
}

/**
 * Reaktive Whisper-Antwort auf Nutzer-Eingabe
 * @param {string} userQuery
 * @param {string} transcript
 * @param {object} context
 * @returns {Promise<{whispered: boolean, text: string}>}
 */
async function whisperReactive(userQuery, transcript, context) {
  try {
    const text = await generateWhisperText(transcript, context, true, userQuery);

    if (!text) {
      return {
        whispered: false,
        text: 'KIMBA_SCHWEIGT',
      };
    }

    return {
      whispered: true,
      text,
    };
  } catch (error) {
    console.error('Fehler bei reaktiver Whisper-Generierung:', error);
    return {
      whispered: false,
      text: 'Fehler bei Whisper-Generierung',
    };
  }
}

module.exports = {
  whisperProactive,
  whisperReactive,
  generateWhisperText,
  playTTS,
  validateWordCount,
  detectMood,
  WHISPER_TTS,
  WHISPER_PREFIXES,
};
