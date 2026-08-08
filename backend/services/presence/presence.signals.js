/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
// (c) 2026 KI-OS.org by Ingo Schaffer und Kimba — AGPL-3.0-only

'use strict';

const { SIGNAL_TYPES, THRESHOLDS } = require('../../schemas/presence.schema');

// Sliding window state for tracking app switches
const appSwitchTimestamps = [];

/**
 * Erstellt ein PresenceEvent mit den gegebenen Parametern.
 * @param {string} type - Der Typ des Signals.
 * @param {string} source - Die Quelle des Signals.
 * @param {object} payload - Die Nutzlast des Signals.
 * @param {number} confidence - Das Konfidenzlevel des Signals (Standard: 1.0).
 * @returns {PresenceEvent} Das erstellte PresenceEvent.
 */
function makeEvent(type, source, payload, confidence = 1.0) {
  return {
    type,
    source: 'mac-bridge',
    payload,
    confidence,
    timestamp: new Date().toISOString()
  };
}

/**
 * Erstellt ein PresenceEvent für einen App-Wechsel.
 * @param {object} prevApp - Die vorherige App.
 * @param {object} currentApp - Die aktuelle App.
 * @returns {PresenceEvent|Array<PresenceEvent>} Das erstellte PresenceEvent oder ein Array von Events.
 *         ACHTUNG: Bei Context-Switch wird ein Array zurückgegeben, nicht nur ein einzelnes Event!
 */
function fromAppChange(prevApp, currentApp) {
  const event = makeEvent(SIGNAL_TYPES.ACTIVE_APP_CHANGED, 'mac-bridge', {
    from: prevApp.appName,
    to: currentApp.appName
  });

  // Aktuellen Timestamp hinzufügen
  const now = Date.now();
  appSwitchTimestamps.push(now);

  // Alte Einträge entfernen (älter als CONTEXT_SWITCH_WINDOW_MS)
  const cutoffTime = now - THRESHOLDS.CONTEXT_SWITCH_WINDOW_MS;
  while (appSwitchTimestamps.length > 0 && appSwitchTimestamps[0] < cutoffTime) {
    appSwitchTimestamps.shift();
  }

  // Prüfen, ob die Anzahl der Switches innerhalb des Zeitfensters den Schwellwert überschreitet
  if (appSwitchTimestamps.length >= THRESHOLDS.CONTEXT_SWITCH_COUNT) {
    const contextSwitchEvent = makeEvent(SIGNAL_TYPES.CONTEXT_SWITCH, 'mac-bridge', {});
    return [event, contextSwitchEvent];
  }

  return event;
}

/**
 * Erstellt ein PresenceEvent für den Beginn eines Meetings.
 * @param {object} meetingState - Der Zustand des Meetings.
 * @returns {PresenceEvent} Das erstellte PresenceEvent.
 */
function fromMeetingStart(meetingState) {
  return makeEvent(SIGNAL_TYPES.MEETING_STARTED, 'mac-bridge', {
    app: meetingState.appName,
    window: meetingState.windowTitle
  });
}

/**
 * Erstellt ein PresenceEvent für das Ende eines Meetings.
 * @returns {PresenceEvent} Das erstellte PresenceEvent.
 */
function fromMeetingEnd() {
  return makeEvent(SIGNAL_TYPES.MEETING_ENDED, 'mac-bridge', {});
}

/**
 * Erstellt ein PresenceEvent für ein bevorstehendes Kalenderereignis.
 * @param {object} calEvent - Das Kalenderereignis.
 * @param {number} minutesUntil - Die Minuten bis zum Ereignis.
 * @returns {PresenceEvent} Das erstellte PresenceEvent.
 */
function fromCalendarEvent(calEvent, minutesUntil) {
  if (minutesUntil <= 2) {
    return makeEvent(SIGNAL_TYPES.CALENDAR_EVENT_UPCOMING, 'mac-bridge', {
      title: calEvent.title,
      isOnline: calEvent.isOnline,
      minutesUntil
    });
  }
  return null;
}

/**
 * Erstellt ein PresenceEvent für eine erfasste Inaktivität.
 * @param {number} idleSinceMs - Die Zeit in Millisekunden, seit die Inaktivität erfasst wurde.
 * @returns {PresenceEvent} Das erstellte PresenceEvent.
 */
function fromIdle(idleSinceMs) {
  return makeEvent(SIGNAL_TYPES.IDLE_DETECTED, 'mac-bridge', {
    idleSinceMs
  });
}

/**
 * Erstellt ein PresenceEvent für einen Kommunikationsburst.
 * @param {number} count - Die Anzahl der Kommunikationsereignisse.
 * @param {number} windowMs - Das Zeitfenster in Millisekunden.
 * @returns {PresenceEvent} Das erstellte PresenceEvent.
 */
function fromCommunicationBurst(count, windowMs) {
  return makeEvent(SIGNAL_TYPES.COMMUNICATION_BURST, 'mac-bridge', {
    count,
    windowMs
  });
}

module.exports = {
  fromAppChange,
  fromMeetingStart,
  fromMeetingEnd,
  fromCalendarEvent,
  fromIdle,
  fromCommunicationBurst
};
