/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
// (c) 2026 KI-OS.org by Ingo Schaffer und Kimba — AGPL-3.0-only
// @desc Presence-System Typen und Konstanten — Single Source of Truth für vP1–vP9
'use strict';

// ─── Zustände ────────────────────────────────────────────────────────────────

const PRESENCE_STATES = Object.freeze({
  FOCUSED:       'FOCUSED',
  FRAGMENTED:    'FRAGMENTED',
  MEETING:       'MEETING',
  COMMUNICATION: 'COMMUNICATION',
  IDLE:          'IDLE',
  PREPARATION:   'PREPARATION',
  REVIEW:        'REVIEW',
  DECISION:      'DECISION',
  OVERLOADED:    'OVERLOADED',
  NIGHT:         'NIGHT',
});

// ─── Kanäle ──────────────────────────────────────────────────────────────────

const CHANNELS = Object.freeze({
  MENUBAR:  'menubar',
  COCKPIT:  'cockpit',
  DISCORD:  'discord',
  WHATSAPP: 'whatsapp',
  WATCH:    'watch',
  CARPLAY:  'carplay',
});

// ─── Interrupt-Level ─────────────────────────────────────────────────────────

const INTERRUPT_LEVELS = Object.freeze({
  SILENT:  'silent',   // kein Output
  BRIEF:   'brief',    // kurze Meldung, kein Ton
  PUSH:    'push',     // aktive Meldung mit Ton/Vibration
  APPROVE: 'approve',  // Nutzer-Aktion erforderlich
  WHISPER: 'whisper',  // AirPods Flüster-Modus (Meeting only)
});

// ─── Signal-Typen ────────────────────────────────────────────────────────────

const SIGNAL_TYPES = Object.freeze({
  // App & Window
  ACTIVE_APP_CHANGED:       'active_app_changed',
  CONTEXT_SWITCH:           'context_switch',
  FOCUS_MODE_ENABLED:       'focus_mode_enabled',
  FOCUS_MODE_DISABLED:      'focus_mode_disabled',
  CODING_SESSION_DETECTED:  'coding_session_detected',
  REVIEW_SESSION_DETECTED:  'review_session_detected',

  // Meeting
  MEETING_STARTED:          'meeting_started',
  MEETING_ENDED:            'meeting_ended',
  CALENDAR_EVENT_UPCOMING:  'calendar_event_upcoming',

  // Communication
  COMMUNICATION_BURST:      'communication_burst',

  // Paraverbal
  PARAVERBAL_SIGNAL:        'paraverbal_signal',
  SPEAKER_IDENTIFIED:       'speaker_identified',
  SPEAKER_NAMED:            'speaker_named',

  // System
  IDLE_DETECTED:            'idle_detected',
  DECISION_PENDING:         'decision_pending',
  OVERLOAD_DETECTED:        'overload_detected',

  // Mission / War Room (intern)
  MISSION_NEW:              'mission:new',
  WARROOM_CREATED:          'warroom:created',
});

// ─── Paraverbale Signale ─────────────────────────────────────────────────────

const PARAVERBAL_SIGNALS = Object.freeze({
  HMM:        'hmm',
  AH:         'ah',           // äh, ähm
  ALSO:       'also',
  REALLY:     'really',       // wirklich? stimmt das?
  DONT_KNOW:  'dont_know',    // ich weiß nicht
  WAIT:       'wait',         // warten Sie
  LONG_PAUSE: 'long_pause',   // > 3s Pause nach Frage
  CLEARING:   'clearing',     // Räuspern → kein Eingriff
  LAUGHING:   'laughing',     // Lachen → kein Eingriff
});

// Signale die KEINEN KIMBA-Eingriff auslösen
const PARAVERBAL_NO_ACTION = new Set([
  PARAVERBAL_SIGNALS.CLEARING,
  PARAVERBAL_SIGNALS.LAUGHING,
]);

// ─── Speaker-Rollen ──────────────────────────────────────────────────────────

const SPEAKER_ROLES = Object.freeze({
  USER:        'user',          // der Nutzer selbst (kalibriert)
  PARTICIPANT: 'participant',   // bekannter Gesprächspartner (aus Teams-Screen)
  UNKNOWN:     'unknown',       // noch nicht zugeordnet
});

// ─── Menüleiste Farben ────────────────────────────────────────────────────────

const MENUBAR_COLORS = Object.freeze({
  FOCUSED:       '#ffffff',
  FRAGMENTED:    '#f59e0b',
  MEETING:       '#ffd700',
  COMMUNICATION: '#00d4ff',
  IDLE:          '#3a5878',
  PREPARATION:   '#ffd700',
  OVERLOADED:    '#ff3355',
  DECISION:      '#00d4ff',
  REVIEW:        '#ffffff',
  NIGHT:         '#000000',
});

// ─── Schwellenwerte (Defaults, alle via .env überschreibbar) ─────────────────

const THRESHOLDS = Object.freeze({
  RELEVANCE_MIN:           parseFloat(process.env.PRESENCE_RELEVANCE_MIN    || '0.75'),
  PARAVERBAL_WEIGHT:       parseFloat(process.env.PRESENCE_PARAVERBAL_WEIGHT || '0.60'),
  MAX_INTERRUPTS_PER_10M:  parseInt(process.env.PRESENCE_MAX_INTERRUPTS      || '3'),
  IDLE_TIMEOUT_MS:         parseInt(process.env.PRESENCE_IDLE_MS             || '300000'),  // 5 min
  CONTEXT_SWITCH_WINDOW_MS:parseInt(process.env.PRESENCE_SWITCH_WINDOW_MS   || '300000'),  // 5 min
  CONTEXT_SWITCH_COUNT:    parseInt(process.env.PRESENCE_SWITCH_COUNT        || '3'),
  CODING_SESSION_MS:       parseInt(process.env.PRESENCE_CODING_MS           || '600000'),  // 10 min
  COMMUNICATION_BURST_COUNT:parseInt(process.env.PRESENCE_COMM_BURST         || '6'),
  COMMUNICATION_WINDOW_MS: parseInt(process.env.PRESENCE_COMM_WINDOW_MS     || '600000'),  // 10 min
  PREPARATION_LEAD_MS:     parseInt(process.env.PRESENCE_PREP_LEAD_MS       || '120000'),  // 2 min
  OVERLOAD_SIGNAL_COUNT:   parseInt(process.env.PRESENCE_OVERLOAD_SIGNALS   || '8'),
  LONG_PAUSE_MS:           parseInt(process.env.PRESENCE_LONG_PAUSE_MS      || '3000'),    // 3s
  CONFIDENCE_MIN:          parseFloat(process.env.PRESENCE_CONFIDENCE_MIN   || '0.70'),
  DEDUP_CACHE_MS:          parseInt(process.env.PRESENCE_DEDUP_CACHE_MS     || '1800000'), // 30 min
});

// ─── HARDRULE: Audio-Isolation ────────────────────────────────────────────────
// KIMBA darf NIEMALS im Teams/Zoom/Meet-Channel zu hören sein.
// TTS-Output → ausschließlich lokaler AirPods-Output.
// BlackHole (virtuelles Device) → read-only, NIEMALS als Mikrofon-Input registriert.
// Guard-Check vor jedem TTS-Call: outputDevice !== meetingInputDevice
// Kein Override, kein env-Flag kann diese Regel umgehen.
const AUDIO_ISOLATION_RULE = Object.freeze({
  TTS_OUTPUT_MUST_BE_LOCAL: true,
  VIRTUAL_DEVICE_READ_ONLY: true,
  GUARD_CHECK_REQUIRED:     true,
  OVERRIDABLE:              false,
});

// ─── Struct-Templates (Dokumentation der erwarteten Objekt-Formen) ────────────

/**
 * PresenceEvent
 * @typedef {{
 *   type: string,         // SIGNAL_TYPES.*
 *   source: string,       // 'mac-bridge' | 'calendar' | 'earpiece' | 'user'
 *   payload: object,
 *   confidence: number,   // 0–1
 *   timestamp: string,    // ISO 8601
 * }} PresenceEvent
 */

/**
 * StateSnapshot
 * @typedef {{
 *   state: string,         // PRESENCE_STATES.*
 *   confidence: number,    // 0–1
 *   since: string,         // ISO 8601
 *   signals: PresenceEvent[],
 *   activeChannel: string, // CHANNELS.*
 * }} StateSnapshot
 */

/**
 * SpeakerProfile
 * @typedef {{
 *   speakerId: string,     // uuid
 *   name: string,          // Echter Name (aus Teams) oder "Sprecher A"
 *   role: string,          // SPEAKER_ROLES.*
 *   voiceEmbedding: number[] | null,  // nur für USER, lokal
 *   firstSeenAt: string,
 *   lastSeenAt: string,
 * }} SpeakerProfile
 */

/**
 * ParaverbalEvent
 * @typedef {{
 *   signal: string,        // PARAVERBAL_SIGNALS.*
 *   speakerId: string,
 *   speakerRole: string,   // SPEAKER_ROLES.*
 *   transcript: string,    // letzter Satz
 *   score: number,         // 0–1 Relevanz
 *   timestamp: string,
 * }} ParaverbalEvent
 */

/**
 * MeetingSummary
 * @typedef {{
 *   meetingId: string,
 *   title: string,
 *   startedAt: string,
 *   endedAt: string,
 *   participants: SpeakerProfile[],
 *   decisions: Array<{speaker: string, content: string, timestamp: string}>,
 *   openPoints: string[],
 *   nextSteps: string[],
 *   keyLearning: string,
 *   transcript: string,   // lokal gespeichert
 * }} MeetingSummary
 */

module.exports = {
  PRESENCE_STATES,
  CHANNELS,
  INTERRUPT_LEVELS,
  SIGNAL_TYPES,
  PARAVERBAL_SIGNALS,
  PARAVERBAL_NO_ACTION,
  SPEAKER_ROLES,
  MENUBAR_COLORS,
  THRESHOLDS,
  AUDIO_ISOLATION_RULE,
};
