/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
// (c) 2026 KI-OS.org by Ingo Schaffer und Kimba — AGPL-3.0-only
'use strict';

const EventEmitter = require('events');
const { batchDetect } = require('./mission.seed-detector');
const { create, getById, getAll, update } = require('./mission.war-room');
const { getRecent, getWindow } = require('../presence/presence.event-buffer');
const { THRESHOLDS } = require('../../schemas/presence.schema');

// Initialize database
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

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
const updateSeedStatusStmt = db.prepare(`
  UPDATE mission_seeds
  SET status = ?, updated_at = ?
  WHERE id = ?
`);

const getSeedByIdStmt = db.prepare(`
  SELECT * FROM mission_seeds
  WHERE id = ?
`);

const getPendingSeedsStmt = db.prepare(`
  SELECT * FROM mission_seeds
  WHERE status = 'pending'
  ORDER BY detected_at DESC
`);

const getConfirmedSeedsStmt = db.prepare(`
  SELECT * FROM mission_seeds
  WHERE status = 'confirmed'
  ORDER BY detected_at DESC
`);

const getDismissedSeedsStmt = db.prepare(`
  SELECT * FROM mission_seeds
  WHERE status = 'dismissed'
  ORDER BY detected_at DESC
`);

// Singleton EventEmitter instance
class MissionInbox extends EventEmitter {
  constructor() {
    super();
    this.pollingInterval = null;
    this.MISSION_POLL_MS = parseInt(process.env.MISSION_POLL_MS) || 30000;
  }

  /**
   * Processes latest events to detect mission seeds and create war rooms if needed
   * @returns {Object} { newSeeds: MissionSeed[], warRoomsCreated: WarRoom[] }
   */
  async processLatestEvents() {
    const windowMs = THRESHOLDS.DEDUP_CACHE_MS;
    const newSeeds = batchDetect(windowMs);
    const warRoomsCreated = [];

    for (const seed of newSeeds) {
      // Find the seed in the database to get its ID
      const dbSeed = getSeedByIdStmt.get(seed.id);

      if (dbSeed.priority === 'CRITICAL' || dbSeed.priority === 'HIGH') {
        const warRoom = create(dbSeed);
        warRoomsCreated.push(warRoom);
        this.emit('warroom:created', warRoom);
      }

      this.emit('mission:new', dbSeed);
    }

    return { newSeeds, warRoomsCreated };
  }

  /**
   * Confirms a pending mission seed and creates a war room
   * @param {number} seedId - ID of the mission seed
   * @returns {WarRoom} Created war room
   */
  async confirmSeed(seedId) {
    const seed = getSeedByIdStmt.get(seedId);
    if (!seed) throw new Error('Seed not found');

    // Update seed status to confirmed
    const now = new Date().toISOString();
    updateSeedStatusStmt.run('confirmed', now, seedId);

    // Create war room
    const warRoom = create(seed);
    this.emit('warroom:created', warRoom);

    return warRoom;
  }

  /**
   * Dismisses a pending mission seed
   * @param {number} seedId - ID of the mission seed
   * @returns {MissionSeed} Updated seed
   */
  async dismissSeed(seedId) {
    const seed = getSeedByIdStmt.get(seedId);
    if (!seed) throw new Error('Seed not found');

    const now = new Date().toISOString();
    updateSeedStatusStmt.run('dismissed', now, seedId);

    const updatedSeed = getSeedByIdStmt.get(seedId);
    this.emit('mission:dismissed', updatedSeed);

    return updatedSeed;
  }

  /**
   * Gets the current inbox state
   * @returns {Object} { pending: MissionSeed[], active: WarRoom[], completed: WarRoom[] }
   */
  async getInbox() {
    const pendingSeeds = getPendingSeedsStmt.all();
    const activeWarRooms = getAll({ status: 'active' });
    const completedWarRooms = getAll({ status: 'completed' });

    return {
      pending: pendingSeeds,
      active: activeWarRooms,
      completed: completedWarRooms
    };
  }

  /**
   * Starts polling for new mission seeds
   * @param {number} intervalMs - Polling interval in milliseconds
   */
  startPolling(intervalMs = this.MISSION_POLL_MS) {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
    }

    this.pollingInterval = setInterval(async () => {
      try {
        await this.processLatestEvents();
      } catch (error) {
        console.error('Error in mission inbox polling:', error);
      }
    }, intervalMs);

    this.emit('polling:started', intervalMs);
  }

  /**
   * Stops polling for new mission seeds
   */
  stopPolling() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
      this.emit('polling:stopped');
    }
  }
}

// Singleton instance
const missionInbox = new MissionInbox();

// Export the public API
module.exports = {
  processLatestEvents: missionInbox.processLatestEvents.bind(missionInbox),
  confirmSeed: missionInbox.confirmSeed.bind(missionInbox),
  dismissSeed: missionInbox.dismissSeed.bind(missionInbox),
  getInbox: missionInbox.getInbox.bind(missionInbox),
  startPolling: missionInbox.startPolling.bind(missionInbox),
  stopPolling: missionInbox.stopPolling.bind(missionInbox),
  on: missionInbox.on.bind(missionInbox),
  off: missionInbox.off.bind(missionInbox),
  emit: missionInbox.emit.bind(missionInbox)
};
