/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
// (c) 2026 KI-OS.org by Ingo Schaffer und Kimba — AGPL-3.0-only
'use strict';

const {
  PRESENCE_STATES,
  CHANNELS,
  INTERRUPT_LEVELS,
  SIGNAL_TYPES
} = require('../../schemas/presence.schema');

// ─── Policy-Matrix ───────────────────────────────────────────────────────────

const POLICY_MATRIX = Object.freeze({
  [PRESENCE_STATES.FOCUSED]: {
    [SIGNAL_TYPES.MISSION_NEW]: {
      CRITICAL: { interruptLevel: INTERRUPT_LEVELS.BRIEF, channels: [CHANNELS.MENUBAR] },
      HIGH: { interruptLevel: INTERRUPT_LEVELS.BRIEF, channels: [CHANNELS.MENUBAR] },
      MEDIUM: { interruptLevel: INTERRUPT_LEVELS.SILENT, channels: [] },
      LOW: { interruptLevel: INTERRUPT_LEVELS.SILENT, channels: [] },
    },
    [SIGNAL_TYPES.WARROOM_CREATED]: {
      _default: { interruptLevel: INTERRUPT_LEVELS.BRIEF, channels: [CHANNELS.COCKPIT] },
    },
    _default: { interruptLevel: INTERRUPT_LEVELS.SILENT, channels: [] },
  },

  [PRESENCE_STATES.MEETING]: {
    _default: { interruptLevel: INTERRUPT_LEVELS.WHISPER, channels: [] },
    CRITICAL: { interruptLevel: INTERRUPT_LEVELS.BRIEF, channels: [CHANNELS.MENUBAR] },
  },

  [PRESENCE_STATES.FRAGMENTED]: {
    [SIGNAL_TYPES.MISSION_NEW]: {
      _default: { interruptLevel: INTERRUPT_LEVELS.PUSH, channels: [CHANNELS.COCKPIT, CHANNELS.MENUBAR] },
    },
    [SIGNAL_TYPES.WARROOM_CREATED]: {
      _default: { interruptLevel: INTERRUPT_LEVELS.BRIEF, channels: [CHANNELS.COCKPIT] },
    },
  },

  [PRESENCE_STATES.IDLE]: {
    _default: { interruptLevel: INTERRUPT_LEVELS.PUSH, channels: [CHANNELS.COCKPIT, CHANNELS.MENUBAR, CHANNELS.DISCORD, CHANNELS.WHATSAPP] },
    CRITICAL: { interruptLevel: INTERRUPT_LEVELS.PUSH, channels: [CHANNELS.COCKPIT, CHANNELS.MENUBAR, CHANNELS.DISCORD, CHANNELS.WHATSAPP, CHANNELS.WATCH] },
  },

  [PRESENCE_STATES.COMMUNICATION]: {
    _default: { interruptLevel: INTERRUPT_LEVELS.PUSH, channels: [CHANNELS.COCKPIT, CHANNELS.MENUBAR, CHANNELS.DISCORD, CHANNELS.WHATSAPP] },
    CRITICAL: { interruptLevel: INTERRUPT_LEVELS.PUSH, channels: [CHANNELS.COCKPIT, CHANNELS.MENUBAR, CHANNELS.DISCORD, CHANNELS.WHATSAPP, CHANNELS.WATCH] },
  },

  [PRESENCE_STATES.NIGHT]: {
    _default: { interruptLevel: INTERRUPT_LEVELS.SILENT, channels: [] },
  },

  [PRESENCE_STATES.DECISION]: {
    _default: { interruptLevel: INTERRUPT_LEVELS.PUSH, channels: [CHANNELS.COCKPIT, CHANNELS.MENUBAR, CHANNELS.DISCORD, CHANNELS.WHATSAPP] },
    _watch: { interruptLevel: INTERRUPT_LEVELS.APPROVE, channels: [CHANNELS.WATCH] },
  },

  // Fallback für alle anderen States
  _default: {
    _default: { interruptLevel: INTERRUPT_LEVELS.BRIEF, channels: [CHANNELS.MENUBAR] },
  },
});

// ─── Aktive Kanäle pro State ─────────────────────────────────────────────────

const ACTIVE_CHANNELS = Object.freeze({
  [PRESENCE_STATES.FOCUSED]: [CHANNELS.MENUBAR],
  [PRESENCE_STATES.MEETING]: [],
  [PRESENCE_STATES.FRAGMENTED]: [CHANNELS.COCKPIT, CHANNELS.MENUBAR],
  [PRESENCE_STATES.IDLE]: [CHANNELS.COCKPIT, CHANNELS.MENUBAR, CHANNELS.DISCORD, CHANNELS.WHATSAPP],
  [PRESENCE_STATES.COMMUNICATION]: [CHANNELS.COCKPIT, CHANNELS.MENUBAR, CHANNELS.DISCORD, CHANNELS.WHATSAPP],
  [PRESENCE_STATES.NIGHT]: [],
  [PRESENCE_STATES.DECISION]: [CHANNELS.COCKPIT, CHANNELS.MENUBAR, CHANNELS.DISCORD, CHANNELS.WHATSAPP, CHANNELS.WATCH],
  _default: [CHANNELS.MENUBAR],
});

// ─── API-Funktionen ──────────────────────────────────────────────────────────

/**
 * Gibt die Policy für einen bestimmten State, SignalType und Priority zurück
 * @param {string} state - Presence-State
 * @param {string} signalType - Signal-Typ
 * @param {string} priority - Priorität (CRITICAL/HIGH/MEDIUM/LOW)
 * @returns {{ interruptLevel: string, channels: string[] }} Policy-Objekt
 */
function getPolicy(state, signalType, priority) {
  // Fallback für unbekannte States
  const statePolicy = POLICY_MATRIX[state] || POLICY_MATRIX._default;

  // Fallback für unbekannte Signal-Typen
  const signalPolicy = statePolicy[signalType] || statePolicy._default || {};

  // Spezifische Priority-Regel oder Default
  const priorityRule = signalPolicy[priority] || signalPolicy._default || statePolicy._default;

  // Watch-Channel für DECISION-State
  if (state === PRESENCE_STATES.DECISION && statePolicy._watch) {
    return {
      interruptLevel: priorityRule.interruptLevel,
      channels: [...priorityRule.channels, ...statePolicy._watch.channels]
    };
  }

  return priorityRule;
}

/**
 * Gibt die aktiven Kanäle für einen bestimmten State zurück
 * @param {string} state - Presence-State
 * @returns {string[]} Array der aktiven Channel-IDs
 */
function getActiveChannels(state) {
  return ACTIVE_CHANNELS[state] || ACTIVE_CHANNELS._default;
}

/**
 * Prüft, ob ein Signal im aktuellen State silent ist
 * @param {string} state - Presence-State
 * @param {string} signalType - Signal-Typ
 * @param {string} priority - Priorität
 * @returns {boolean} true, wenn silent
 */
function isSilent(state, signalType, priority) {
  const policy = getPolicy(state, signalType, priority);
  return policy.interruptLevel === INTERRUPT_LEVELS.SILENT;
}

// ─── Export ───────────────────────────────────────────────────────────────────

module.exports = {
  getPolicy,
  getActiveChannels,
  isSilent,
};
