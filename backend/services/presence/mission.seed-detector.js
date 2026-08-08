/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
// (c) 2026 KI-OS.org by Ingo Schaffer und Kimba — AGPL-3.0-only
'use strict';

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const { SIGNAL_TYPES, THRESHOLDS } = require('../../schemas/presence.schema');
const { getWindow, countByType } = require('./presence.event-buffer');

// Initialize database
const dbPath = process.env.PRESENCE_DB_PATH || path.join(process.cwd(), 'data', 'presence.db');
const dbDir = path.dirname(dbPath);

fs.mkdirSync(dbDir, { recursive: true });

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

// Create mission_seeds table if it doesn't exist
db.exec(`
  CREATE TABLE IF NOT EXISTS mission_seeds (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    type        TEXT NOT NULL,
    title       TEXT NOT NULL,
    priority    TEXT NOT NULL,
    confidence  REAL NOT NULL,
    status      TEXT DEFAULT 'pending',
    payload     TEXT,
    detected_at TEXT NOT NULL,
    updated_at  TEXT NOT NULL
  )
`);

// Prepare SQL statements
const insertSeedStmt = db.prepare(`
  INSERT INTO mission_seeds
  (type, title, priority, confidence, status, payload, detected_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

const getRecentSeedsStmt = db.prepare(`
  SELECT * FROM mission_seeds
  WHERE detected_at >= ?
  ORDER BY detected_at DESC
`);

/**
 * Detects ALL matching mission patterns in a set of presence events
 * @param {Array<PresenceEvent>} events - Array of presence events
 * @returns {Array<Object>} All detected mission seeds (empty array if none)
 */
function detectMissionSeed(events) {
  if (!events || events.length === 0) return [];

  const seeds = [];

  // Post-Meeting Followup
  const meetingStarted = events.find(e => e.type === SIGNAL_TYPES.MEETING_STARTED);
  if (meetingStarted) {
    const postMeetingEvents = events.filter(e => e.timestamp > meetingStarted.timestamp);
    const contextSwitchCount = postMeetingEvents.filter(e => e.type === SIGNAL_TYPES.CONTEXT_SWITCH).length;
    if (contextSwitchCount >= THRESHOLDS.CONTEXT_SWITCH_COUNT) {
      seeds.push({
        isMission: true,
        title: 'Post-Meeting Followup',
        priority: 'HIGH',
        type: 'post_meeting_followup',
        confidence: Math.min(1, contextSwitchCount / THRESHOLDS.CONTEXT_SWITCH_COUNT),
        triggerEvents: postMeetingEvents.filter(e =>
          e.type === SIGNAL_TYPES.CONTEXT_SWITCH || e.type === SIGNAL_TYPES.MEETING_STARTED
        )
      });
    }
  }

  // Communication Overload
  const communicationBurstCount = countByType(SIGNAL_TYPES.COMMUNICATION_BURST, THRESHOLDS.COMMUNICATION_WINDOW_MS);
  if (communicationBurstCount >= THRESHOLDS.COMMUNICATION_BURST_COUNT) {
    seeds.push({
      isMission: true,
      title: 'Communication Overload',
      priority: 'HIGH',
      type: 'communication_overload',
      confidence: Math.min(1, communicationBurstCount / THRESHOLDS.COMMUNICATION_BURST_COUNT),
      triggerEvents: events.filter(e => e.type === SIGNAL_TYPES.COMMUNICATION_BURST)
    });
  }

  // Pending Decision
  const decisionPending = events.find(e => e.type === SIGNAL_TYPES.DECISION_PENDING);
  if (decisionPending) {
    seeds.push({
      isMission: true,
      title: 'Pending Decision',
      priority: 'CRITICAL',
      type: 'pending_decision',
      confidence: decisionPending.confidence || 1,
      triggerEvents: [decisionPending]
    });
  }

  // Upcoming Meeting Prep
  const upcomingEvent = events.find(e => e.type === SIGNAL_TYPES.CALENDAR_EVENT_UPCOMING);
  if (upcomingEvent) {
    const timeDiff = new Date(upcomingEvent.timestamp).getTime() - Date.now();
    if (timeDiff <= THRESHOLDS.PREPARATION_LEAD_MS && timeDiff > 0) {
      seeds.push({
        isMission: true,
        title: 'Upcoming Meeting Prep',
        priority: 'MEDIUM',
        type: 'meeting_prep',
        confidence: Math.min(1, (THRESHOLDS.PREPARATION_LEAD_MS - timeDiff) / THRESHOLDS.PREPARATION_LEAD_MS),
        triggerEvents: [upcomingEvent]
      });
    }
  }

  // Interrupted Deep Work
  const codingSession = events.find(e => e.type === SIGNAL_TYPES.CODING_SESSION_DETECTED);
  if (codingSession) {
    const postCodingEvents = events.filter(e => e.timestamp > codingSession.timestamp);
    const contextSwitchCount = postCodingEvents.filter(e => e.type === SIGNAL_TYPES.CONTEXT_SWITCH).length;
    if (contextSwitchCount >= 5) {
      seeds.push({
        isMission: true,
        title: 'Interrupted Deep Work',
        priority: 'MEDIUM',
        type: 'interrupted_deep_work',
        confidence: Math.min(1, contextSwitchCount / 5),
        triggerEvents: postCodingEvents.filter(e =>
          e.type === SIGNAL_TYPES.CONTEXT_SWITCH || e.type === SIGNAL_TYPES.CODING_SESSION_DETECTED
        )
      });
    }
  }

  return seeds;
}

/**
 * Analyzes events in a time window for mission patterns
 * @param {number} windowMs - Time window in milliseconds
 * @returns {Array<Object>} Array of detected mission seeds
 */
function batchDetect(windowMs = THRESHOLDS.CONTEXT_SWITCH_WINDOW_MS) {
  const events = getWindow(windowMs);
  const detectedSeeds = detectMissionSeed(events);

  if (detectedSeeds.length === 0) return [];

  const cutoff = new Date(Date.now() - THRESHOLDS.DEDUP_CACHE_MS).toISOString();
  const recentSeeds = getRecentSeedsStmt.all(cutoff);
  const now = new Date().toISOString();

  const result = [];
  for (const missionSeed of detectedSeeds) {
    const duplicate = recentSeeds.find(s =>
      s.type === missionSeed.type && s.status === 'pending'
    );

    if (!duplicate) {
      const info = insertSeedStmt.run(
        missionSeed.type, missionSeed.title, missionSeed.priority,
        missionSeed.confidence, 'pending', JSON.stringify(missionSeed.triggerEvents), now, now
      );
      missionSeed.id = info.lastInsertRowid;
      missionSeed.detected_at = now;
      missionSeed.status = 'pending';
      result.push(missionSeed);
    }
    // Duplikate werden stillschweigend ignoriert (Dedup-Schutz)
  }

  return result;
}

module.exports = {
  detectMissionSeed,
  batchDetect
};
