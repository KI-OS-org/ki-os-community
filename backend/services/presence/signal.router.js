/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
// (c) 2026 KI-OS.org by Ingo Schaffer und Kimba — AGPL-3.0-only
'use strict';

const {
  getChannel,
  getChannelsForInterruptLevel,
  formatForChannel,
  CHANNEL_DEFS
} = require('./channel.registry');

const {
  PRESENCE_STATES,
  INTERRUPT_LEVELS,
  CHANNELS,
  THRESHOLDS
} = require('../../schemas/presence.schema');

const { getPolicy } = require('./presence.policy');

// ─── Singleton Router-Zustand ───────────────────────────────────────────────

const routerState = {
  dispatchTimestamps: [],    // Array von Timestamps der letzten Dispatches
  suppressedQueue: [],       // Array von gedrosselten Signalen
};

// ─── State → erlaubter Interrupt-Level ──────────────────────────────────────

const STATE_TO_INTERRUPT_LEVELS = Object.freeze({
  [PRESENCE_STATES.FOCUSED]: [INTERRUPT_LEVELS.BRIEF],
  [PRESENCE_STATES.MEETING]: [INTERRUPT_LEVELS.WHISPER],
  [PRESENCE_STATES.FRAGMENTED]: [
    INTERRUPT_LEVELS.BRIEF,
    INTERRUPT_LEVELS.PUSH
  ],
  [PRESENCE_STATES.DECISION]: [
    INTERRUPT_LEVELS.PUSH,
    INTERRUPT_LEVELS.APPROVE
  ],
  [PRESENCE_STATES.IDLE]: Object.values(INTERRUPT_LEVELS),
  [PRESENCE_STATES.NIGHT]: [INTERRUPT_LEVELS.SILENT],
  [PRESENCE_STATES.COMMUNICATION]: [INTERRUPT_LEVELS.BRIEF],
  [PRESENCE_STATES.PREPARATION]: [INTERRUPT_LEVELS.BRIEF],
});

// ─── Helper-Funktionen ──────────────────────────────────────────────────────

/**
 * Prüft, ob ein Signal gedrosselt werden soll
 * @param {Object} signal - Das Signal-Objekt
 * @param {Object} currentState - Aktueller State
 * @returns {boolean} true, wenn Signal gedrosselt werden soll
 */
function shouldThrottle(signal, currentState) {
  // Im Meeting-Modus nur WHISPER erlauben
  if (currentState.state === PRESENCE_STATES.MEETING) {
    return signal.interruptLevel !== INTERRUPT_LEVELS.WHISPER;
  }

  // In NIGHT-Modus immer gedrosselt
  if (currentState.state === PRESENCE_STATES.NIGHT) {
    return true;
  }

  // Prüfen, ob Interrupt-Level für aktuellen State erlaubt ist
  const allowedLevels = STATE_TO_INTERRUPT_LEVELS[currentState.state] || [INTERRUPT_LEVELS.BRIEF];
  return !allowedLevels.includes(signal.interruptLevel);
}

/**
 * Prüft, ob Rate-Limit überschritten wurde
 * @returns {boolean} true, wenn Rate-Limit überschritten
 */
function isRateLimitExceeded() {
  const now = Date.now();
  const windowStart = now - 10 * 60 * 1000; // 10 Minuten

  // Alte Einträge entfernen
  routerState.dispatchTimestamps = routerState.dispatchTimestamps.filter(
    ts => ts > windowStart
  );

  return routerState.dispatchTimestamps.length >= THRESHOLDS.MAX_INTERRUPTS_PER_10M;
}

/**
 * Fügt einen Dispatch-Timestamp hinzu
 */
function recordDispatch() {
  routerState.dispatchTimestamps.push(Date.now());
}

/**
 * Fügt ein Signal zur gedrosselten Queue hinzu
 * @param {Object} signal - Das Signal-Objekt
 */
function enqueueSuppressed(signal) {
  if (routerState.suppressedQueue.length < 10) {
    routerState.suppressedQueue.push({
      signal,
      timestamp: Date.now()
    });
  }
}

/**
 * Gibt die Anzahl der gedrosselten Signale zurück
 * @returns {number} Anzahl der gedrosselten Signale
 */
function getSuppressedCount() {
  return routerState.suppressedQueue.length;
}

/**
 * Gibt alle gedrosselten Signale zurück und leert die Queue
 * @returns {Array} Array der gedrosselten Signale
 */
function flushSuppressed() {
  const signals = routerState.suppressedQueue.map(item => item.signal);
  routerState.suppressedQueue = [];
  return signals;
}

// ─── Haupt-Routing-Funktionen ─────────────────────────────────────────────────

/**
 * Prüft, ob ein Signal dispatched werden soll
 * @param {Object} signal - Das Signal-Objekt
 * @param {Object} currentState - Aktueller State
 * @returns {boolean} true, wenn Signal dispatched werden soll
 */
function shouldDispatch(signal, currentState) {
  // NIGHT-Modus → nie dispatchen
  if (currentState.state === PRESENCE_STATES.NIGHT) {
    return false;
  }

  // SILENT-Level → nie dispatchen
  if (signal.interruptLevel === INTERRUPT_LEVELS.SILENT) {
    return false;
  }

  // Rate-Limit prüfen
  if (isRateLimitExceeded()) {
    return false;
  }

  // State-spezifische Prüfung
  const allowedLevels = STATE_TO_INTERRUPT_LEVELS[currentState.state] || [INTERRUPT_LEVELS.BRIEF];
  return allowedLevels.includes(signal.interruptLevel);
}

/**
 * Routet ein Signal zu den entsprechenden Kanälen
 * @param {Object} signal - Das Signal-Objekt
 * @param {Object} currentState - Aktueller State
 * @returns {Object} RoutingResult-Objekt
 */
function routeSignal(signal, currentState) {
  // Interrupt-Level aus Policy ableiten wenn nicht explizit gesetzt
  const policy = getPolicy(currentState.state, signal.type, signal.priority);
  const interruptLevel = signal.interruptLevel || policy.interruptLevel || INTERRUPT_LEVELS.BRIEF;
  const enriched = { ...signal, interruptLevel };

  const result = {
    dispatched: false,
    channels: [],
    interruptLevel,
    formattedMessages: {},
    reason: ''
  };

  // Prüfen, ob Signal gedrosselt werden soll
  if (shouldThrottle(enriched, currentState)) {
    result.reason = `Signal gedrosselt: State ${currentState.state} erlaubt nur ${STATE_TO_INTERRUPT_LEVELS[currentState.state]?.join(', ')}`;
    enqueueSuppressed(enriched);
    return result;
  }

  // Prüfen, ob Signal dispatched werden soll
  if (!shouldDispatch(enriched, currentState)) {
    result.reason = isRateLimitExceeded()
      ? 'Rate-Limit überschritten'
      : `State ${currentState.state} erlaubt nicht ${interruptLevel}`;
    enqueueSuppressed(enriched);
    return result;
  }

  // Kanäle für den Interrupt-Level finden
  const channels = signal.channels
    ? signal.channels.map(id => getChannel(id)).filter(Boolean)
    : getChannelsForInterruptLevel(result.interruptLevel);

  if (channels.length === 0) {
    result.reason = `Keine Kanäle für Interrupt-Level ${result.interruptLevel}`;
    return result;
  }

  // Nachricht formatieren und an Kanäle senden
  channels.forEach(channel => {
    const formatted = formatForChannel(signal.message, channel.id);
    result.formattedMessages[channel.id] = formatted;
    result.channels.push(channel.id);
  });

  // Dispatch-Timestamp aufnehmen
  recordDispatch();
  result.dispatched = true;
  result.reason = 'Signal erfolgreich geroutet';

  return result;
}

// ─── Export ───────────────────────────────────────────────────────────────────

function clearRouterState() {
  routerState.dispatchTimestamps = [];
  routerState.suppressedQueue = [];
}

module.exports = {
  routeSignal,
  shouldDispatch,
  flushSuppressed,
  getSuppressedCount,
  clearRouterState,
};
