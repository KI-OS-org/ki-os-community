/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
/**
 * KI-OS — (C) 2026 Ingo Schaffer
 * https://ki-os.org
 * @license AGPL-3.0-only
 */
/**
 * (c) 2026 KI-OS.org — AgentMesh Runtime Store
 * Hybrid store: in-memory Map for fast reads + JSON file persistence.
 *
 * Config env vars:
 *   MESH_STORE_FILE          — path to JSON store file (default: .ki-os-mesh-runs.json in cwd)
 *   MESH_MAX_RUNS            — max runs cap before eviction (default: 500)
 *   MESH_RUN_RETENTION_DAYS  — delete runs older than N days on startup (default: 30)
 */
'use strict';

const fs     = require('fs');
const path   = require('path');
const logger = require('../core/logger.service');

const STORE_FILE     = process.env.MESH_STORE_FILE || path.join(process.cwd(), '.ki-os-mesh-runs.json');
const MAX_RUNS       = Number(process.env.MESH_MAX_RUNS || 500);
const RETENTION_DAYS = Number(process.env.MESH_RUN_RETENTION_DAYS || 30);

/** @type {Map<string, object>} */
const runs = new Map();
/** Insertion-order list of runIds for eviction */
const runOrder = [];

/** Debounce handle for saveToDisk */
let _saveTimer = null;

function now() {
  return new Date().toISOString();
}

// ─── disk persistence ────────────────────────────────────────────────────────

/**
 * Load persisted runs from disk into the in-memory store.
 * On any read error: saves a backup of the corrupted file, then starts with empty store.
 */
function loadFromDisk() {
  try {
    if (!fs.existsSync(STORE_FILE)) return;
    const raw = fs.readFileSync(STORE_FILE, 'utf8').trim();
    if (!raw) return; // empty file = start fresh, no error
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) return;
    for (const run of data) {
      if (run && run.runId && !runs.has(run.runId)) {
        runs.set(run.runId, run);
        runOrder.push(run.runId);
      }
    }
  } catch (err) {
    // Save corrupted file as backup before starting fresh
    try {
      const backupFile = STORE_FILE + '.corrupt-' + Date.now();
      fs.copyFileSync(STORE_FILE, backupFile);
      logger.info('mesh.store.corrupted_backup_saved', { backupFile });
    } catch { /* ignore backup failure */ }
    logger.warn('mesh.store.load_failed', { error: String(err.message) });
  }
}

/**
 * Persist all runs to disk using an atomic write (tmp → rename).
 * Called via a 100 ms debounce to avoid hammering disk on rapid step updates.
 */
function _flushToDisk() {
  try {
    const data    = runOrder.map(id => runs.get(id)).filter(Boolean);
    const tmpFile = STORE_FILE + '.tmp';
    fs.mkdirSync(path.dirname(STORE_FILE), { recursive: true });
    fs.writeFileSync(tmpFile, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tmpFile, STORE_FILE);
  } catch (err) {
    logger.warn('mesh.store.save_failed', { error: String(err.message) });
  }
}

function saveToDisk() {
  if (_saveTimer) clearTimeout(_saveTimer);
  _saveTimer = setTimeout(_flushToDisk, 100);
}

/**
 * Delete runs older than RETENTION_DAYS from both the Map and runOrder.
 * Called once on module init.
 */
function pruneOldRuns() {
  const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
  const toDelete = [];
  for (const [runId, run] of runs.entries()) {
    const ts = run.createdAt ? new Date(run.createdAt).getTime() : 0;
    if (ts < cutoff) toDelete.push(runId);
  }
  if (toDelete.length === 0) return;
  for (const runId of toDelete) {
    runs.delete(runId);
    const idx = runOrder.indexOf(runId);
    if (idx !== -1) runOrder.splice(idx, 1);
  }
  logger.info('mesh.store.pruned', { count: toDelete.length });
  saveToDisk();
}

// ─── store operations ────────────────────────────────────────────────────────

/**
 * Store a new run. Evicts oldest if MAX_RUNS exceeded.
 * @param {object} data - MeshRun object from createMeshRun()
 * @returns {object}
 */
function createRun(data) {
  if (runs.size >= MAX_RUNS) {
    const oldest = runOrder.shift();
    if (oldest) runs.delete(oldest);
  }
  const run = Object.assign({}, data, { steps: Array.isArray(data.steps) ? [...data.steps] : [] });
  runs.set(run.runId, run);
  runOrder.push(run.runId);
  saveToDisk();
  return run;
}

/**
 * Retrieve a run by ID.
 * @param {string} runId
 * @returns {object|null}
 */
function getRun(runId) {
  return runs.get(String(runId || '')) || null;
}

/**
 * Apply partial updates to a run.
 * @param {string} runId
 * @param {object} updates
 * @returns {object|null}
 */
function updateRun(runId, updates) {
  const run = runs.get(String(runId || ''));
  if (!run) return null;
  Object.assign(run, updates, { runId: run.runId });
  saveToDisk();
  return run;
}

/**
 * List runs with optional filtering.
 * @param {object} [opts]
 * @param {number} [opts.limit]
 * @param {string} [opts.userId]
 * @param {string} [opts.tenantId]
 * @param {string} [opts.status]
 * @returns {{ runs: object[], total: number }}
 */
function listRuns({ limit = 50, userId, tenantId, status } = {}) {
  let all = runOrder.map(id => runs.get(id)).filter(Boolean).reverse();
  if (userId)   all = all.filter(r => r.userId   === userId);
  if (tenantId) all = all.filter(r => r.tenantId === tenantId);
  if (status)   all = all.filter(r => r.status   === status);
  const total = all.length;
  return { runs: all.slice(0, Math.max(1, Number(limit || 50))), total };
}

/**
 * Add a step to a run.
 * @param {string} runId
 * @param {object} step - MeshStep object from createMeshStep()
 * @returns {object|null} updated run or null
 */
function addStep(runId, step) {
  const run = runs.get(String(runId || ''));
  if (!run) return null;
  if (!Array.isArray(run.steps)) run.steps = [];
  run.steps.push(Object.assign({}, step));
  saveToDisk();
  return run;
}

/**
 * Apply partial updates to a step within a run.
 * @param {string} runId
 * @param {string} stepId
 * @param {object} updates
 * @returns {object|null} updated step or null
 */
function updateStep(runId, stepId, updates) {
  const run = runs.get(String(runId || ''));
  if (!run || !Array.isArray(run.steps)) return null;
  const step = run.steps.find(s => s.stepId === stepId);
  if (!step) return null;
  Object.assign(step, updates, { stepId: step.stepId, runId: step.runId });
  saveToDisk();
  return step;
}

/**
 * Returns store statistics.
 * @returns {{ totalRuns: number, activeRuns: number, fileSize: number, storeFile: string }}
 */
function getStoreStats() {
  const activeStatuses = new Set(['PENDING', 'PLANNING', 'EXECUTING', 'REVIEWING', 'SYNTHESIZING']);
  let activeRuns = 0;
  for (const run of runs.values()) {
    if (activeStatuses.has(run.status)) activeRuns++;
  }
  let fileSize = 0;
  try { fileSize = fs.existsSync(STORE_FILE) ? fs.statSync(STORE_FILE).size : 0; } catch {}
  return { totalRuns: runs.size, activeRuns, fileSize, storeFile: STORE_FILE };
}

// ─── module init ─────────────────────────────────────────────────────────────

// Remove any leftover .tmp file from a previous crash before loading
const _tmpFile = STORE_FILE + '.tmp';
try {
  if (fs.existsSync(_tmpFile)) {
    fs.unlinkSync(_tmpFile);
    logger.info('mesh.store.removed_stale_tmp', { tmpFile: _tmpFile });
  }
} catch { /* ignore */ }

loadFromDisk();
pruneOldRuns();

module.exports = { createRun, getRun, updateRun, listRuns, addStep, updateStep, getStoreStats };
