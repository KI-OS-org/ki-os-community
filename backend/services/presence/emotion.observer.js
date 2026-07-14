/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
// (c) 2026 KI-OS.org by Ingo Schaffer und Kimba — AGPL-3.0-only
// @desc Emotion Observer — Screenshot → Gemini Vision → Gemütszustände der Meeting-Teilnehmer
'use strict';

const fs = require('fs');
const path = require('path');
const EventEmitter = require('events');
const axios = require('axios');

const GEMINI_KEY    = () => process.env.GEMINI_API_KEY || '';
const GEMINI_MODEL  = process.env.EMOTION_VISION_MODEL || 'gemini-2.0-flash';
const GEMINI_URL    = () =>
  `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(GEMINI_KEY())}`;

const DEFAULT_INTERVAL_SECS = parseInt(process.env.EMOTION_INTERVAL_SECS) || 20;
const DRY_RUN = () => process.env.EMOTION_DRY_RUN === 'true';

// Emotionen die einen Flüster-Alert auslösen
const ALERT_EMOTIONS = new Set(['skeptisch', 'angespannt', 'gelangweilt', 'ablehnend', 'verwirrt']);

// ─── Prompt ──────────────────────────────────────────────────────────────────

const VISION_PROMPT = `Analysiere diesen Meeting-Screenshot.
Identifiziere alle sichtbaren Personen (Videokonferenz-Kacheln oder physisch anwesend).
Für jede Person gib an:
- name: "Person 1", "Person 2" etc. (oder erkennbarer Name falls sichtbar)
- emotion: genau eines von: neutral | zustimmend | skeptisch | begeistert | gelangweilt | angespannt | nachdenklich | ablehnend | verwirrt | abwesend
- engagement: 0–100 (Aufmerksamkeit/Präsenz)
- signals: Array mit max. 3 Beobachtungen zu Mimik/Gestik/Körperhaltung (je max. 5 Wörter)

Antworte NUR als JSON-Array. Beispiel:
[{"name":"Person 1","emotion":"skeptisch","engagement":60,"signals":["Stirn gerunzelt","Arme verschränkt","Blick abgewandt"]}]

Wenn kein Gesicht sichtbar: antworte mit []`;

// ─── Klasse ───────────────────────────────────────────────────────────────────

class EmotionObserver extends EventEmitter {
  constructor() {
    super();
    this._interval = null;
    this._latestEmotions = [];
    this._alertHistory = [];
    this._frameCount = 0;
    this._captureScreenshot = null; // injiziert vom earpiece.manager
  }

  /**
   * Startet periodische Emotion-Beobachtung
   * @param {Function} screenshotFn - async () => { success, path }
   * @param {number} intervalSecs
   */
  start(screenshotFn, intervalSecs = DEFAULT_INTERVAL_SECS) {
    if (this._interval) this.stop();
    this._captureScreenshot = screenshotFn;

    this._interval = setInterval(async () => {
      try {
        await this._tick();
      } catch (err) {
        this.emit('error', err);
      }
    }, intervalSecs * 1000);

    this.emit('observer:started', { intervalSecs });
  }

  stop() {
    if (this._interval) {
      clearInterval(this._interval);
      this._interval = null;
    }
    this.emit('observer:stopped', { frameCount: this._frameCount });
  }

  /** Einmalige Frame-Analyse (ohne laufenden Interval) */
  async analyzeFrame(screenshotPath) {
    return this._analyzeImage(screenshotPath);
  }

  /**
   * Stimmbasierter Trigger: sofort Screenshot + Analyse, kein Warten auf Interval.
   * Wird von _handleRelevanceTrigger aufgerufen wenn Audio-Analyse ein Signal erkennt.
   * @param {string} [audioReason] - Grund warum die Stimme getriggert hat (für Kontext)
   * @returns {Promise<Array>} Erkannte Emotionen
   */
  async triggerOnce(audioReason) {
    if (!this._captureScreenshot) return [];
    try {
      await this._tick(audioReason);
    } catch (err) {
      this.emit('error', err);
    }
    return this._latestEmotions;
  }

  getLatestEmotions() {
    return this._latestEmotions;
  }

  getAlertHistory() {
    return this._alertHistory;
  }

  reset() {
    this.stop();
    this._latestEmotions = [];
    this._alertHistory = [];
    this._frameCount = 0;
    this._captureScreenshot = null;
  }

  // ─── Intern ─────────────────────────────────────────────────────────────────

  async _tick(audioReason) {
    if (!this._captureScreenshot) return;

    const shot = await this._captureScreenshot();
    if (!shot || !shot.success || !shot.path) return;

    const emotions = await this._analyzeImage(shot.path);
    this._frameCount++;
    this._latestEmotions = emotions;

    this.emit('emotion:update', {
      emotions,
      trigger: audioReason ? 'voice' : 'periodic',
      audioReason: audioReason || null,
      frameCount: this._frameCount,
      ts: new Date().toISOString()
    });

    // Alert-Emotionen prüfen
    const alerts = emotions.filter(p => ALERT_EMOTIONS.has(p.emotion));
    if (alerts.length > 0) {
      const alert = {
        persons: alerts,
        trigger: audioReason ? 'voice' : 'periodic',
        audioReason: audioReason || null,
        ts: new Date().toISOString()
      };
      this._alertHistory.push(alert);
      this.emit('emotion:alert', alert);
    }
  }

  async _analyzeImage(imagePath) {
    if (DRY_RUN()) {
      return _mockEmotions();
    }

    if (!GEMINI_KEY()) {
      throw new Error('GEMINI_API_KEY nicht konfiguriert');
    }

    const imageBuffer = fs.readFileSync(imagePath);
    const base64Image = imageBuffer.toString('base64');
    const ext = path.extname(imagePath).toLowerCase();
    const mimeType = ext === '.png' ? 'image/png' : 'image/jpeg';

    const resp = await axios.post(GEMINI_URL(), {
      contents: [{
        parts: [
          { inlineData: { mimeType, data: base64Image } },
          { text: VISION_PROMPT }
        ]
      }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 512 }
    }, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 20000
    });

    const raw = resp.data?.candidates?.[0]?.content?.parts?.[0]?.text || '[]';
    return _parseEmotionResponse(raw);
  }
}

// ─── Hilfsfunktionen ──────────────────────────────────────────────────────────

function _parseEmotionResponse(raw) {
  try {
    const cleaned = raw
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```\s*$/, '')
      .trim();
    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(p => ({
      name:       String(p.name || 'Unbekannt'),
      emotion:    String(p.emotion || 'neutral'),
      engagement: Math.min(100, Math.max(0, parseInt(p.engagement) || 50)),
      signals:    Array.isArray(p.signals) ? p.signals.slice(0, 3) : []
    }));
  } catch {
    return [];
  }
}

function _mockEmotions() {
  return [
    { name: 'Person 1', emotion: 'neutral',    engagement: 75, signals: ['aufmerksam', 'Blickkontakt'] },
    { name: 'Person 2', emotion: 'skeptisch',  engagement: 60, signals: ['Stirn gerunzelt', 'Arme verschränkt'] },
    { name: 'Person 3', emotion: 'zustimmend', engagement: 85, signals: ['nickt', 'offen'] }
  ];
}

// ─── Singleton ────────────────────────────────────────────────────────────────

let _instance = null;

function getInstance() {
  if (!_instance) _instance = new EmotionObserver();
  return _instance;
}

function resetInstance() {
  if (_instance) _instance.reset();
  _instance = null;
}

module.exports = {
  getInstance,
  resetInstance,
  ALERT_EMOTIONS,
  // Direkt-API für Tests
  analyzeFrame: (p) => getInstance().analyzeFrame(p),
  getLatestEmotions: () => getInstance().getLatestEmotions(),
};
