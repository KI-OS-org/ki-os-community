/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
// (c) 2026 KI-OS.org by Ingo Schaffer und Kimba — AGPL-3.0-only
// @desc Presence Agent — Pollt Mac-Bridge, evaluiert Zustand, emittiert Änderungen
'use strict';

const { PRESENCE_STATES, THRESHOLDS, MENUBAR_COLORS } = require('../../schemas/presence.schema');
const macBridge = require('./presence.mac-bridge');
const eventBuffer = require('./presence.event-buffer');
const signals = require('./presence.signals');
const stateMachine = require('./presence.state-machine');
const EventEmitter = require('events');

class PresenceAgent extends EventEmitter {
  constructor() {
    super();
    this._running = false;
    this._interval = null;
    this._currentState = {
      state: PRESENCE_STATES.IDLE,
      confidence: 1.0,
      since: new Date().toISOString(),
      color: MENUBAR_COLORS.IDLE
    };
    this._prevAppName = null;
    this._meetingActive = false;
    this._pollIntervalMs = parseInt(process.env.PRESENCE_POLL_MS || '5000');
  }

  start() {
    if (this._running) return this;

    this._running = true;
    this._interval = setInterval(() => this._tick(), this._pollIntervalMs);
    this._tick(); // Sofortiger erster Tick
    return this;
  }

  stop() {
    if (this._interval) {
      clearInterval(this._interval);
      this._interval = null;
    }
    this._running = false;
    this.removeAllListeners();
  }

  async _tick() {
    try {
      // 1. Daten sammeln
      const app = await macBridge.getActiveApp();
      const meeting = await macBridge.getMeetingState();
      const calendar = await macBridge.getCalendarEvents(120); // Minuten

      // 2. App-Wechsel erkennen
      if (this._prevAppName !== null && app.appName !== this._prevAppName) {
        signals.fromAppChange(this._prevAppName, app);
      }
      this._prevAppName = app.appName;

      // 3. Meeting-Wechsel erkennen
      if (meeting.inMeeting && !this._meetingActive) {
        signals.fromMeetingStart(meeting);
      } else if (!meeting.inMeeting && this._meetingActive) {
        signals.fromMeetingEnd();
      }
      this._meetingActive = meeting.inMeeting;

      // 4. Kalender-Events prüfen
      const now = Date.now();
      for (const calEvent of calendar) {
        const eventStart = new Date(calEvent.start).getTime();
        const minutesUntil = Math.floor((eventStart - now) / 60000);
        if (minutesUntil <= 2 && minutesUntil >= 0) {
          signals.fromCalendarEvent(calEvent);
        }
      }

      // 5. State evaluieren
      const recent = eventBuffer.getRecent(50);
      const window = eventBuffer.getWindow(THRESHOLDS.CONTEXT_SWITCH_WINDOW_MS);
      const result = stateMachine.evaluate(recent, window);

      // 6. State-Change emittieren
      if (result.state !== this._currentState.state) {
        this._currentState = {
          state: result.state,
          confidence: result.confidence,
          since: new Date().toISOString(),
          color: MENUBAR_COLORS[result.state]
        };
        this.emit('state:changed', this._currentState);
      }

      this.emit('state:tick', this._currentState);

    } catch (err) {
      console.error('[PresenceAgent] Fehler im tick:', err.message);
    }
  }

  getState() {
    return this._currentState;
  }
}

module.exports = new PresenceAgent(); // Singleton
