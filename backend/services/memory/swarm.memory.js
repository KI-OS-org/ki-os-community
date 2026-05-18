/**
 * KI-OS Community Edition — Core Infrastructure
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: Apache License 2.0
 * SPDX-License-Identifier: Apache-2.0
 */
/**
 * (c) 2026 KI-OS.org by Ingo Schaffer und Kimba
 * @license AGPL-3.0-only
 * @file    swarm.memory.js
 * @desc    KI-OS Swarm Memory — ACO-inspirierter persistenter Wissensspeicher.
 *          Kombiniert Ant Colony Optimization (confidence + decay) mit
 *          Reinforcement Learning (feedback) für adaptives Team-Gedächtnis.
 *          Claude, Qwen und DeepSeek teilen diesen Speicher über Sessions hinweg.
 * @author  Ingo Schaffer <ingo@ki-os.org>
 * @coauthor Kimba <kimba@ki-os.org>
 * @license AGPL-3.0-only — https://www.gnu.org/licenses/agpl-3.0.html
 * (c) 2026 KI-OS.org by Ingo Schaffer und Kimba
 */

'use strict';

const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');

let logger;
try {
  logger = require('../core/logger.service');
} catch {
  logger = { info: () => {}, warn: () => {}, error: () => {} };
}

// ─── Config ───────────────────────────────────────────────────────────────────

function _dbPath() { return process.env.SWARM_MEMORY_PATH || path.join(process.cwd(), '.swarm-memory', 'store.json'); }
const MAX_ENTRIES  = Number(process.env.SWARM_MEMORY_MAX  || 1000);
function _backend() { return (process.env.SWARM_MEMORY_BACKEND || 'json').toLowerCase(); }
let _lanceBackend = null;
function _getLance() {
  if (!_lanceBackend) _lanceBackend = require('./swarm.lancedb');
  return _lanceBackend;
}

// ACO-Parameter (Ant Colony Optimization)
const DECAY_LAMBDA        = Number(process.env.SWARM_DECAY_LAMBDA || 0.05); // Pheromon-Verdunstung pro Tag
const DECAY_FLOOR         = 0.05;  // Minimale confidence — Entry "stirbt" nie komplett
const INITIAL_CONFIDENCE  = 0.70;  // Startvertrauen für neue Einträge

// RL-Parameter (Reinforcement Learning via feedback())
const FEEDBACK_BOOST   = 0.15;  // confidence ↑ bei positivem Feedback
const FEEDBACK_PENALTY = 0.10;  // confidence ↓ bei negativem Feedback

// ─── Storage ──────────────────────────────────────────────────────────────────

let _cache    = null;
let _cachePath = null; // Pfad für den der Cache gilt — Invalidierung wenn Pfad wechselt

function loadStore() {
  const p = _dbPath();
  if (_cache && _cachePath === p) return _cache;
  _cache = null; _cachePath = p;

  const dir = path.dirname(p);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  if (!fs.existsSync(p)) {
    _cache = { entries: [], version: 1, createdAt: Date.now() };
    return _cache;
  }

  try {
    _cache = JSON.parse(fs.readFileSync(p, 'utf8'));
    if (!Array.isArray(_cache.entries)) _cache.entries = [];
  } catch {
    _cache = { entries: [], version: 1, createdAt: Date.now() };
  }

  return _cache;
}

function saveStore() {
  const store = loadStore();
  store.updatedAt = Date.now();
  fs.writeFileSync(_cachePath, JSON.stringify(store, null, 2), 'utf8');
}

// ─── ACO: Pheromon-Decay ─────────────────────────────────────────────────────

/**
 * Berechnet die effektive Confidence eines Eintrags unter Berücksichtigung
 * des zeitbasierten Decay (Pheromon-Verdunstung).
 *
 * Formula: effectiveConfidence = confidence * e^(-lambda * daysSinceLastUse)
 *
 * @param {object} entry
 * @returns {number} effectiveConfidence [DECAY_FLOOR, 0.99]
 */
function applyDecay(entry) {
  const now     = Date.now();
  const lastUse = entry.lastUsed || entry.createdAt || now;
  const days    = Math.max(0, (now - lastUse) / 86400000);
  const decayed = entry.confidence * Math.exp(-DECAY_LAMBDA * days);
  return Number(Math.max(DECAY_FLOOR, decayed).toFixed(4));
}

// ─── Scoring ──────────────────────────────────────────────────────────────────

/**
 * Berechnet den Relevanz-Score eines Eintrags für eine gegebene Query.
 * Kombiniert Keyword-Overlap, ACO-Confidence und Usage-Boost.
 *
 * @param {object} entry
 * @param {string} query
 * @returns {number} score [0, 1]
 */
function scoreEntry(entry, query) {
  const q         = (query || '').toLowerCase();
  const text      = (entry.text || '').toLowerCase();
  const entryType = (entry.metadata?.type || '').toLowerCase();

  // Keyword-Overlap (60% Gewichtung)
  const tokens     = q.split(/\s+/).filter(t => t.length > 2);
  const matchCount = tokens.length > 0
    ? tokens.filter(t => text.includes(t)).length
    : 0;
  const keywordScore = tokens.length > 0 ? matchCount / tokens.length : 0.1;

  // ACO: Decay-adjustierte Confidence (30% Gewichtung)
  const effectiveConf = applyDecay(entry);

  // Typ-Boost — Patterns und Decisions vor Anti-Patterns
  const typeBoost = entryType === 'pattern'     ? 0.10
                  : entryType === 'decision'    ? 0.08
                  : entryType === 'contract'    ? 0.07
                  : entryType === 'antipattern' ? 0.06
                  : entryType === 'review'      ? 0.04
                  : 0;

  // Usage-Boost (Verstärkung wie Pheromon-Pfad-Verbreiterung)
  const usageBoost = Math.min(0.10, (entry.usageCount || 0) * 0.01);

  const total = (keywordScore * 0.60) + (effectiveConf * 0.30) + typeBoost + usageBoost;
  return Number(Math.min(1, Math.max(0, total)).toFixed(4));
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Speichert einen Eintrag im Swarm Memory.
 * Doppelte Einträge (selber Text-Hash) werden aktualisiert statt neu angelegt.
 *
 * @param {string} text       - Zu speicherndes Wissen (Pattern, Decision, ...)
 * @param {object} [metadata] - { type, author, sprint, file, feature, ... }
 * @returns {{ id: string, created?: boolean, updated?: boolean }}
 */
function store(text, metadata = {}) {
  if (!text || !String(text).trim()) {
    throw new Error('swarm.memory.store: text darf nicht leer sein');
  }
  if (_backend() === 'lancedb') return _getLance().store(text, metadata);

  const db  = loadStore();
  const id  = crypto.createHash('sha1').update(String(text).trim()).digest('hex').slice(0, 12);
  const now = Date.now();

  // Deduplizierung via Text-Hash
  const existing = db.entries.find(e => e.id === id);
  if (existing) {
    existing.usageCount  = (existing.usageCount || 0) + 1;
    existing.lastUsed    = now;
    existing.metadata    = { ...existing.metadata, ...metadata };
    saveStore();
    logger.info('swarm.memory.store.updated', { id, type: existing.metadata.type });
    return { id, updated: true };
  }

  const entry = {
    id,
    text:       String(text).trim(),
    confidence: INITIAL_CONFIDENCE,
    usageCount: 0,
    createdAt:  now,
    lastUsed:   now,
    metadata: {
      type:   'pattern',
      author: 'claude',
      sprint: 'unknown',
      ...metadata
    }
  };

  db.entries.push(entry);

  // Kapazitäts-Management: Einträge mit niedrigster effektiver Confidence werden
  // zuerst entfernt (analog zu Pheromon-Verdunstung bis auf Null)
  if (db.entries.length > MAX_ENTRIES) {
    db.entries.sort((a, b) => applyDecay(b) - applyDecay(a));
    db.entries = db.entries.slice(0, MAX_ENTRIES);
  }

  saveStore();
  logger.info('swarm.memory.store.created', { id, type: entry.metadata.type });
  return { id, created: true };
}

/**
 * Ruft die k relevantesten Einträge für eine Query ab.
 * Score kombiniert Keyword-Overlap, ACO-Confidence und Usage-Boost.
 *
 * @param {string} query
 * @param {number} [k=5]
 * @returns {Array<{ id, text, score, effectiveConfidence, metadata, ... }>}
 */
function retrieve(query, k = 5) {
  if (!query) return [];
  if (_backend() === 'lancedb') return _getLance().retrieve(query, k);

  const db = loadStore();

  // Tracking: usageCount + lastUsed für abgerufene Einträge aktualisieren
  const results = db.entries
    .map(entry => ({
      entry,
      score: scoreEntry(entry, query),
      effectiveConfidence: applyDecay(entry)
    }))
    .filter(r => r.score > 0.05)
    .sort((a, b) => b.score - a.score)
    .slice(0, k);

  // Verstärkung: Nutzung erhöht usageCount (ACO: häufig genutzter Pfad)
  let dirty = false;
  for (const r of results) {
    r.entry.usageCount = (r.entry.usageCount || 0) + 1;
    r.entry.lastUsed   = Date.now();
    dirty = true;
  }
  if (dirty) saveStore();

  return results.map(r => ({
    id:                  r.entry.id,
    text:                r.entry.text,
    score:               r.score,
    effectiveConfidence: r.effectiveConfidence,
    usageCount:          r.entry.usageCount,
    metadata:            r.entry.metadata
  }));
}

/**
 * Gibt einen formatierten Kontext-String zurück — direkt für Prompt-Injection nutzbar.
 *
 * @param {string} query
 * @param {number} [k=5]
 * @returns {string} Leerer String wenn kein Kontext gefunden
 */
function retrieveAsContext(query, k = 5) {
  if (_backend() === 'lancedb') return _getLance().retrieveAsContext(query, k);
  const results = retrieve(query, k);
  if (results.length === 0) return '';

  const lines = results.map(r => {
    const tag  = r.metadata?.type ? `[${r.metadata.type.toUpperCase()}]` : '[MEMORY]';
    const conf = `(conf:${r.effectiveConfidence.toFixed(2)})`;
    return `- ${tag} ${r.text} ${conf}`;
  });

  return `RELEVANTER SWARM-KONTEXT:\n${lines.join('\n')}`;
}

/**
 * RL-Feedback: Verstärkt oder schwächt einen Eintrag basierend auf Ergebnis.
 * Positiv = Confidence ↑ (guter Weg)
 * Negativ = Confidence ↓ (schlechter Weg)
 *
 * @param {string}  id       - Eintrag-ID (aus store() oder retrieve())
 * @param {boolean} positive - true = Erfolg, false = Misserfolg
 * @returns {{ found: boolean, id?: string, confidence?: number }}
 */
function feedback(id, positive = true) {
  const db    = loadStore();
  const entry = db.entries.find(e => e.id === id);

  if (!entry) {
    logger.warn('swarm.memory.feedback.notFound', { id });
    return { found: false };
  }

  if (positive) {
    entry.confidence = Number(Math.min(0.99, entry.confidence + FEEDBACK_BOOST).toFixed(4));
    entry.usageCount = (entry.usageCount || 0) + 1;
  } else {
    entry.confidence = Number(Math.max(DECAY_FLOOR, entry.confidence - FEEDBACK_PENALTY).toFixed(4));
  }
  entry.lastUsed = Date.now();

  saveStore();
  logger.info('swarm.memory.feedback', { id, positive, newConfidence: entry.confidence });
  return { found: true, id, confidence: entry.confidence };
}

/**
 * Statistiken über den aktuellen Swarm Memory Zustand.
 * Zeigt ACO-Gesundheit: durchschnittliche effektive Confidence, Typenverteilung.
 *
 * @returns {object}
 */
function getStats() {
  if (_backend() === 'lancedb') return _getLance().getStats();
  const db      = loadStore();
  const entries = db.entries;

  const byType = {};
  for (const e of entries) {
    const t    = e.metadata?.type || 'unknown';
    byType[t]  = (byType[t] || 0) + 1;
  }

  const avgConf = entries.length
    ? Number((entries.reduce((s, e) => s + e.confidence, 0) / entries.length).toFixed(3))
    : 0;

  const avgEffConf = entries.length
    ? Number((entries.reduce((s, e) => s + applyDecay(e), 0) / entries.length).toFixed(3))
    : 0;

  return {
    total:                  entries.length,
    byType,
    avgConfidence:          avgConf,
    avgEffectiveConfidence: avgEffConf,
    decayLambda:            DECAY_LAMBDA,
    decayFloor:             DECAY_FLOOR,
    maxEntries:             MAX_ENTRIES,
    dbPath:                 _dbPath()
  };
}

/**
 * Löscht Einträge, deren effektive Confidence unter den Decay Floor gefallen ist.
 * Kann periodisch aufgerufen werden (z.B. beim App-Start).
 *
 * @returns {{ removed: number }}
 */
function prune() {
  const db  = loadStore();
  const before = db.entries.length;
  db.entries = db.entries.filter(e => applyDecay(e) > DECAY_FLOOR);
  const removed = before - db.entries.length;
  if (removed > 0) saveStore();
  logger.info('swarm.memory.prune', { removed, remaining: db.entries.length });
  return { removed };
}

/**
 * Gibt Einträge aus dem Store zurück — für die /swarm/entries API.
 *
 * @param {number} [limit=50]
 * @param {string} [type]     - Filter nach metadata.type
 * @returns {Array}
 */
function getEntries(limit = 50, type = null) {
  if (_backend() === 'lancedb') return _getLance().getEntries(limit, type);
  const db = loadStore();
  let entries = db.entries;
  if (type) entries = entries.filter(e => e.metadata?.type === type);
  return entries.slice(0, limit).map(e => ({
    id:                  e.id,
    text:                e.text,
    confidence:          e.confidence,
    effectiveConfidence: Number(applyDecay(e).toFixed(4)),
    usageCount:          e.usageCount || 0,
    createdAt:           e.createdAt,
    lastUsed:            e.lastUsed,
    metadata:            e.metadata
  }));
}

// ─── Module Export ────────────────────────────────────────────────────────────

module.exports = {
  store,
  retrieve,
  retrieveAsContext,
  feedback,
  getStats,
  getEntries,
  prune,
  applyDecay  // Exportiert für Tests
};
