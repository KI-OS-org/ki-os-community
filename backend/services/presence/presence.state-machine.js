/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
// (c) 2026 KI-OS.org by Ingo Schaffer und Kimba — AGPL-3.0-only
// @desc Presence State Machine — evaluiert Zustand aus Events
'use strict';

const { PRESENCE_STATES, SIGNAL_TYPES, THRESHOLDS } = require('../../schemas/presence.schema');

/**
 * Zählt wie oft ein Event-Typ in einem Array vorkommt
 * @param {string} type - Der zu suchende Event-Typ
 * @param {Array} events - Array von Events
 * @returns {number} Anzahl der Treffer
 */
function countByType(type, events) {
  return events.filter(e => e.type === type).length;
}

/**
 * Prüft ob es Nacht ist (Standard: <7 oder >=20 Uhr)
 * @returns {boolean}
 */
function isNightTime() {
  const hour = new Date().getHours();
  const NIGHT_START = parseInt(process.env.NIGHT_START || '20');
  const NIGHT_END = parseInt(process.env.NIGHT_END || '7');
  return hour < NIGHT_END || hour >= NIGHT_START;
}

/**
 * Findet das letzte Event eines Typs
 * @param {string} type - Gesuchter Event-Typ
 * @param {Array} events - Array von Events
 * @returns {object|null} Das gefundene Event oder null
 */
function getLastEvent(type, events) {
  return events.find(e => e.type === type) || null;
}

/**
 * Prüft ob ein Event-Typ nach einem anderen auftritt
 * @param {string} type - Der zu suchende Event-Typ
 * @param {string} afterType - Der Typ, nach dem gesucht wird
 * @param {Array} events - Array von Events
 * @returns {boolean}
 */
function hasEventAfter(type, afterType, events) {
  const typeIndex = events.findIndex(e => e.type === type);
  if (typeIndex === -1) return false;
  return events.slice(0, typeIndex).some(e => e.type === afterType);
}

/**
 * Evaluiert den aktuellen Presence-Zustand aus Events
 * @param {Array} recentEvents - Letzte 50 Events (neueste zuerst)
 * @param {Array} windowEvents - Events der letzten 5 Minuten
 * @returns {{state: string, confidence: number, reason: string}} Zustand mit Konfidenz
 */
function evaluate(recentEvents, windowEvents) {
  const now = Date.now();

  // 1. MEETING: meeting_started ohne nachfolgendes meeting_ended
  const meetingStarted = getLastEvent(SIGNAL_TYPES.MEETING_STARTED, recentEvents);
  if (meetingStarted) {
    const meetingEnded = getLastEvent(SIGNAL_TYPES.MEETING_ENDED, recentEvents);
    if (!meetingEnded || new Date(meetingStarted.timestamp) > new Date(meetingEnded.timestamp)) {
      return {
        state: PRESENCE_STATES.MEETING,
        confidence: 0.95,
        reason: 'Laufendes Meeting erkannt'
      };
    }
  }

  // 2. PREPARATION: calendar_event_upcoming in den letzten 2 Minuten
  const upcomingEvent = getLastEvent(SIGNAL_TYPES.CALENDAR_EVENT_UPCOMING, recentEvents);
  if (upcomingEvent) {
    const timeDiff = now - new Date(upcomingEvent.timestamp).getTime();
    if (timeDiff <= THRESHOLDS.PREPARATION_LEAD_MS) {
      return {
        state: PRESENCE_STATES.PREPARATION,
        confidence: 0.90,
        reason: 'Kalenderevent steht kurz bevor'
      };
    }
  }

  // 3. FOCUSED: coding_session_detected ohne context_switch dazwischen
  const codingSession = getLastEvent(SIGNAL_TYPES.CODING_SESSION_DETECTED, recentEvents);
  if (codingSession) {
    const contextSwitch = getLastEvent(SIGNAL_TYPES.CONTEXT_SWITCH, recentEvents);
    if (!contextSwitch || new Date(contextSwitch.timestamp) < new Date(codingSession.timestamp)) {
      const sessionAge = now - new Date(codingSession.timestamp).getTime();
      if (sessionAge <= THRESHOLDS.CODING_SESSION_MS) {
        return {
          state: PRESENCE_STATES.FOCUSED,
          confidence: 0.85,
          reason: 'Aktive Coding-Session ohne Unterbrechung'
        };
      }
    }
  }

  // 4. FRAGMENTED: zu viele Context-Switches
  if (countByType(SIGNAL_TYPES.CONTEXT_SWITCH, windowEvents) > THRESHOLDS.CONTEXT_SWITCH_COUNT) {
    return {
      state: PRESENCE_STATES.FRAGMENTED,
      confidence: 0.75,
      reason: 'Viele Kontextwechsel erkannt'
    };
  }

  // 5. COMMUNICATION: Kommunikations-Burst
  if (countByType(SIGNAL_TYPES.COMMUNICATION_BURST, windowEvents) > 0) {
    return {
      state: PRESENCE_STATES.COMMUNICATION,
      confidence: 0.75,
      reason: 'Kommunikationsaktivität erkannt'
    };
  }

  // 6. IDLE: neuestes Event ist idle_detected oder Timeout
  const lastEvent = recentEvents[0];
  if (lastEvent && lastEvent.type === SIGNAL_TYPES.IDLE_DETECTED) {
    return {
      state: PRESENCE_STATES.IDLE,
      confidence: 0.95,
      reason: 'Idle-Modus aktiv'
    };
  }

  // Timeout-basiertes Idle prüfen
  if (lastEvent) {
    const idleTime = now - new Date(lastEvent.timestamp).getTime();
    if (idleTime > THRESHOLDS.IDLE_TIMEOUT_MS) {
      return {
        state: PRESENCE_STATES.IDLE,
        confidence: 0.80,
        reason: 'Keine Aktivität festgestellt'
      };
    }
  }

  // 7. NIGHT: Zeitbasiert
  if (isNightTime()) {
    return {
      state: PRESENCE_STATES.NIGHT,
      confidence: 1.0,
      reason: 'Nachtmodus aktiv'
    };
  }

  // 8. Fallback
  return {
    state: PRESENCE_STATES.IDLE,
    confidence: 0.50,
    reason: 'Kein anderer Zustand erkannt'
  };
}

module.exports = {
  evaluate,
  isNightTime
};
