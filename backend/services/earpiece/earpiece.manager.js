/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
// (c) 2026 KI-OS.org by Ingo Schaffer und Kimba — AGPL-3.0-only
'use strict';

const EventEmitter = require('events');
const vad = require('./earpiece.vad');
const transcriber = require('./earpiece.transcriber');
const relevance = require('./earpiece.relevance');
const whisperEngine = require('./earpiece.whisper-engine');
const opinionEngine = require('./earpiece.opinion');
const postMeeting = require('./earpiece.post-meeting');
const emotionObserver = require('../presence/emotion.observer');
const desktopEngine = require('../desktop/desktop.engine');
const { AUDIO_ISOLATION_RULE } = require('../../schemas/presence.schema');

// Singleton instance
let instance = null;

class EarpieceManager extends EventEmitter {
  constructor() {
    super();

    // Validate HARDRULES
    if (!AUDIO_ISOLATION_RULE.TTS_OUTPUT_MUST_BE_LOCAL) {
      throw new Error('HARDRULE VERLETZT: Audio-Isolation nicht aktiv');
    }
    if (AUDIO_ISOLATION_RULE.OVERRIDABLE) {
      throw new Error('HARDRULE VERLETZT: OVERRIDABLE darf nicht true sein');
    }

    this.state = 'IDLE';
    this.meetingContext = null;
    this.whisperCount = 0;
    this.suppressedCount = 0;
    this.bufferStats = {
      segmentCount: 0,
      totalSecs: 0,
      languages: []
    };
  }

  /**
   * Startet den PRE_MEETING Zustand
   * @param {Object} meetingContext - Meeting-Kontext
   * @param {string} meetingContext.title - Meeting-Titel
   * @param {Date} meetingContext.startTime - Startzeit
   * @param {string[]} meetingContext.participants - Teilnehmerliste
   */
  async startPreMeeting(meetingContext) {
    if (this.state !== 'IDLE') {
      throw new Error(`Cannot start pre-meeting from state ${this.state}`);
    }

    this.state = 'PRE_MEETING';
    this.meetingContext = {
      ...meetingContext,
      startedAt: new Date(),
      whisperCount: 0,
      suppressedCount: 0
    };

    // Reset transcriber buffer
    transcriber.clearBuffer();

    // Generate meeting brief (LLM call or stub)
    if (process.env.EARPIECE_DRY_RUN === 'true') {
      this.meetingContext.brief = '[MOCK BRIEF: Meeting vorbereiten...]';
    } else {
      try {
        // In real implementation, this would be an LLM call
        this.meetingContext.brief = await this._generateMeetingBrief(meetingContext);
      } catch (error) {
        console.error('Fehler beim Generieren des Meeting Briefs:', error);
        this.meetingContext.brief = '[Fehler beim Generieren des Briefs]';
      }
    }
  }

  /**
   * Startet das Meeting (ACTIVE Zustand)
   */
  startMeeting() {
    if (this.state !== 'PRE_MEETING') {
      throw new Error(`Cannot start meeting from state ${this.state}`);
    }

    this.state = 'ACTIVE';
    this.meetingContext.startedAt = new Date();

    // Emotion Observer starten (Screenshot → Gemini Vision)
    const observer = emotionObserver.getInstance();
    observer.start(
      () => desktopEngine.captureScreenshot(),
      parseInt(process.env.EMOTION_INTERVAL_SECS) || 20
    );
    observer.on('emotion:alert', ({ persons, ts }) => {
      this.emit('emotion:alert', { persons, ts });
    });
    observer.on('emotion:update', (data) => {
      this.meetingContext.latestEmotions = data.emotions;
      this.emit('emotion:update', data);
    });

    // Relevanz-Evaluation mit Emotions-Kontext
    relevance.startContinuousEvaluation(
      () => transcriber.getLastText(5),
      ({ score, reasons }) => {
        this._handleRelevanceTrigger(score, reasons);
      }
    );

    this.emit('meeting:started', {
      meetingContext: this.meetingContext,
      ts: new Date().toISOString()
    });
  }

  /**
   * Verarbeitet ein Flüstern des Nutzers
   * @param {Buffer} audioBuffer - Audio-Daten
   * @returns {Promise<{response: string}>} Antwort des Systems
   */
  async handleUserWhisper(audioBuffer) {
    if (this.state !== 'ACTIVE') {
      throw new Error(`Cannot handle whisper in state ${this.state}`);
    }

    // VAD analysis
    const vadResult = vad.analyzePCM(audioBuffer);

    if (!vadResult.isWhisper) {
      this.suppressedCount++;
      this.emit('whisper:suppressed', {
        reason: 'not_whisper_level',
        score: 0,
        ts: new Date().toISOString()
      });
      return { response: 'KIMBA_SCHWEIGT' };
    }

    // Transcribe the audio
    const transcription = await transcriber.transcribeChunk(audioBuffer, 'audio/wav');
    transcriber.addToBuffer({
      text: transcription.text,
      ts: Date.now(),
      duration: audioBuffer.length / 16000, // Assuming 16kHz sample rate
      language: transcription.language
    });

    // Update buffer stats
    this.bufferStats = transcriber.getBufferStats();

    // ── Stiller Trigger: "hmm" o.ä. → KIMBA gibt Meinung zum Meeting ──────────
    if (opinionEngine.isTrigger(transcription.text)) {
      const meetingTranscript = transcriber.getLastText(20);
      const emotionSummary = (emotionObserver.getLatestEmotions() || [])
        .map(p => `${p.name}: ${p.emotion}`)
        .join(', ') || null;

      let opinionText = null;
      try {
        opinionText = await opinionEngine.generateOpinion(
          meetingTranscript,
          { ...this.meetingContext, emotionSummary }
        );
      } catch (err) {
        console.error('Opinion Fehler:', err.message);
      }

      if (opinionText) {
        await whisperEngine.playTTS(opinionText);
        this.whisperCount++;
        this.emit('whisper:sent', {
          text: opinionText,
          mode: 'opinion',
          trigger: opinionEngine.OPINION_TRIGGER(),
          ts: new Date().toISOString()
        });
      } else {
        this.suppressedCount++;
        this.emit('whisper:suppressed', { reason: 'kimba_schweigt', score: 0, ts: new Date().toISOString() });
      }

      return { response: opinionText || 'KIMBA_SCHWEIGT', mode: 'opinion' };
    }

    // ── Normale reaktive Antwort auf Nutzer-Frage ─────────────────────────────
    const whisperResponse = await whisperEngine.whisperReactive(
      transcription.text,
      transcriber.getLastText(10),
      this.meetingContext
    );

    if (whisperResponse.whispered) {
      this.whisperCount++;
      this.emit('whisper:sent', {
        text: whisperResponse.text,
        mode: 'reactive',
        score: 1,
        ts: new Date().toISOString()
      });
    } else {
      this.suppressedCount++;
      this.emit('whisper:suppressed', {
        reason: 'no_relevant_content',
        score: 0,
        ts: new Date().toISOString()
      });
    }

    return { response: whisperResponse.text };
  }

  /**
   * Beendet das Meeting und generiert den PostMeeting-Report
   * @returns {Promise<PostMeetingReport>} PostMeeting-Report
   */
  async endMeeting() {
    if (this.state !== 'ACTIVE') {
      throw new Error(`Cannot end meeting from state ${this.state}`);
    }

    this.state = 'POST_MEETING';
    this.meetingContext.endedAt = new Date();

    // Emotion Observer + Relevanz stoppen
    emotionObserver.getInstance().stop();
    relevance.stopEvaluation();

    // Process meeting end
    const report = await postMeeting.processMeetingEnd(this.meetingContext);

    // Update meeting context with final stats
    this.meetingContext.whisperCount = this.whisperCount;
    this.meetingContext.suppressedCount = this.suppressedCount;

    // Reset state
    this.state = 'IDLE';

    this.emit('meeting:ended', {
      report,
      ts: new Date().toISOString()
    });

    return report;
  }

  /**
   * Gibt den aktuellen Status zurück
   * @returns {Object} Status-Informationen
   */
  getStatus() {
    return {
      state: this.state,
      meetingContext: this.meetingContext,
      whisperCount: this.whisperCount,
      suppressedCount: this.suppressedCount,
      bufferStats: this.bufferStats,
      latestEmotions: emotionObserver.getLatestEmotions(),
      emotionAlerts: emotionObserver.getInstance().getAlertHistory().length
    };
  }

  // ─── Private Methoden ───────────────────────────────────────────────────────

  /**
   * Generiert einen Meeting-Brief (Stub oder LLM-Call)
   * @param {Object} meetingContext - Meeting-Kontext
   * @returns {Promise<string>} Meeting-Brief
   */
  async _generateMeetingBrief(meetingContext) {
    // In real implementation, this would be an LLM call
    // For now, return a stub
    return `Meeting Brief für: ${meetingContext.title}\n` +
           `Teilnehmer: ${meetingContext.participants.join(', ')}\n` +
           `Startzeit: ${meetingContext.startTime.toISOString()}`;
  }

  /**
   * Verarbeitet einen Relevanz-Trigger
   * @param {number} score - Relevanz-Score
   * @param {string[]} reasons - Gründe für den Trigger
   */
  async _handleRelevanceTrigger(score, reasons) {
    const transcript = transcriber.getLastText(10);

    // Stimme hat Signal erkannt → sofort Screenshot für visuellen Kontext
    const audioReason = reasons.join('; ');
    const emotions = await emotionObserver.getInstance().triggerOnce(audioReason);

    // Emotions-Snapshot in Meeting-Kontext einbetten
    const enrichedContext = {
      ...this.meetingContext,
      emotionSnapshot: emotions,
      emotionSummary: emotions.length > 0
        ? emotions.map(p => `${p.name}: ${p.emotion} (${p.engagement}%)`).join(', ')
        : null
    };

    const whisperResponse = await whisperEngine.whisperProactive(
      transcript,
      enrichedContext,
      reasons
    );

    if (whisperResponse.whispered) {
      this.whisperCount++;
      this.emit('whisper:sent', {
        text: whisperResponse.text,
        mode: 'proactive',
        score,
        ts: new Date().toISOString()
      });
    } else {
      this.suppressedCount++;
      this.emit('whisper:suppressed', {
        reason: 'no_relevant_content',
        score,
        ts: new Date().toISOString()
      });
    }
  }
}

// Singleton export
function getInstance() {
  if (!instance) {
    instance = new EarpieceManager();
  }
  return instance;
}

function resetInstance() {
  emotionObserver.resetInstance();
  instance = null;
}

// Export public API
module.exports = {
  getInstance,
  resetInstance,
  // Convenience methods that forward to the singleton instance
  startPreMeeting: (...args) => getInstance().startPreMeeting(...args),
  startMeeting: (...args) => getInstance().startMeeting(...args),
  handleUserWhisper: (...args) => getInstance().handleUserWhisper(...args),
  endMeeting: (...args) => getInstance().endMeeting(...args),
  getStatus: (...args) => getInstance().getStatus(...args),
  on: (...args) => getInstance().on(...args),
  off: (...args) => getInstance().off(...args)
};
