/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
/**
 * (c) 2026 KI-OS.org by Ingo Schaffer und Kimba
 * @file    swarm.routes.js
 * @desc    HTTP-API für KI-OS Swarm Memory — store, search, stats, entries, feedback.
 * @license AGPL-3.0-only
 */
'use strict';

const router = require('express').Router();
const swarm  = require('../services/memory/swarm.memory');
const { requireBusinessTier } = require('../middleware/license.gate');

// POST /api/swarm/store
router.post('/store', async (req, res) => {
  try {
    const { text, metadata } = req.body || {};
    if (!text) return res.status(400).json({ error: 'text fehlt' });
    const result = await Promise.resolve(swarm.store(text, metadata || {}));
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/swarm/search
router.post('/search', async (req, res) => {
  try {
    const { query, k } = req.body || {};
    if (!query) return res.status(400).json({ error: 'query fehlt' });
    const results = await Promise.resolve(swarm.retrieve(query, k || 5));
    const context = await Promise.resolve(swarm.retrieveAsContext(query, k || 5));
    res.json({ results, context });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/swarm/stats
router.get('/stats', async (req, res) => {
  try {
    const stats = await Promise.resolve(swarm.getStats());
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/swarm/entries
router.get('/entries', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const type  = req.query.type || null;
    const entries = await Promise.resolve(swarm.getEntries(limit, type));
    res.json({ entries });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/swarm/feedback
router.post('/feedback', async (req, res) => {
  try {
    const { id, positive } = req.body || {};
    if (!id) return res.status(400).json({ error: 'id fehlt' });
    const result = swarm.feedback(id, positive !== false);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/swarm/context?query=X&k=5
router.get('/context', requireBusinessTier, async (req, res) => {
  try {
    const { query, k: kParam } = req.query || {};
    if (!query) return res.status(400).json({ error: 'query fehlt' });
    const k = Math.min(parseInt(kParam) || 5, 10);
    const context = await Promise.resolve(swarm.retrieveAsContext(query, k));
    res.json({ context, query, k });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/swarm/brief
router.post('/brief', requireBusinessTier, async (req, res) => {
  try {
    const { task, k: kParam } = req.body || {};
    if (!task) return res.status(400).json({ error: 'task fehlt' });
    const k = Math.min(kParam || 5, 10);
    const context = await Promise.resolve(swarm.retrieveAsContext(task, k));
    const brief = `## Relevanter Swarm-Kontext für: ${task}\n\n${context}\n\n---\nℹ️ ${k} Einträge aus LanceDB Swarm Memory`;
    res.json({ brief, task, k, generatedAt: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

const memoryBroker = require('../services/memory/memory.broker');

function normalizeK(value) {
  const parsed = parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed <= 0) return 5;
  return Math.min(parsed, 10);
}

function formatMemoryLines(entries, heading) {
  const lines = (Array.isArray(entries) ? entries : []).map((entry) => {
    const type = entry?.type || entry?.category || 'memory';
    const text = entry?.text || entry?.content || '';
    return `- [${type}] ${String(text).trim()}`;
  });
  return [heading, ...lines].join('\n');
}

async function brokerSearch(query, k) {
  // swarm.memory.js ist der korrekte Service für direkte Suchen
  return Promise.resolve(swarm.retrieve(query, k));
}

function removeRoute(method, path) {
  router.stack = router.stack.filter((layer) => {
    return !(layer.route
      && layer.route.path === path
      && layer.route.methods
      && layer.route.methods[method]);
  });
}

removeRoute('get', '/context');
removeRoute('post', '/brief');

// GET /api/swarm/context
router.get('/context', async (req, res) => {
  try {
    const { query, k: kParam } = req.query || {};
    if (!query) return res.status(400).json({ error: 'query fehlt' });

    const k = normalizeK(kParam);
    const entries = await Promise.resolve(brokerSearch(query, k));
    const context = formatMemoryLines(entries, '## Relevanter Kontext');

    res.json({
      success: true,
      context,
      entries,
      count: Array.isArray(entries) ? entries.length : 0
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/swarm/brief
router.post('/brief', async (req, res) => {
  try {
    const { task, k: kParam } = req.body || {};
    if (!task) return res.status(400).json({ error: 'task fehlt' });

    const k = normalizeK(kParam);
    const relevantEntries = await Promise.resolve(brokerSearch(task, k));
    const injectionReady = formatMemoryLines(
      relevantEntries,
      '## Swarm Memory Kontext\nFolgende Erkenntnisse sind relevant fuer diese Task:'
    );

    res.json({
      success: true,
      memoryContext: injectionReady,
      relevantEntries,
      injectionReady
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
