/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
// (c) 2026 KI-OS.org by Ingo Schaffer und Kimba — AGPL-3.0-only
// @desc Timeline API — append/recent/search/blacklist/delete-range (S6, vD4)
'use strict';

const express = require('express');
const router = express.Router();
const timelineStore = require('../services/timeline/timeline.store.js');
const timelinePrivacy = require('../services/timeline/timeline.privacy.js');
const timelineLancedb = require('../services/timeline/timeline.lancedb.js');

/**
 * POST /append - Fügt einen neuen Timeline-Eintrag hinzu
 */
router.post('/append', async (req, res) => {
  const { app, windowTitle, content, change, message, urgency } = req.body;

  if (!app) {
    return res.status(400).json({ error: 'app muss angegeben werden' });
  }

  try {
    if (timelinePrivacy.isBlacklisted(app)) {
      return res.json({ stored: false, reason: 'blacklisted' });
    }

    const stored = timelineStore.append({ app, windowTitle, content, change, message, urgency });
    // Fire-and-forget Indexierung
    timelineLancedb.indexEntry(stored).catch(() => {});

    res.json({ stored: true, entry: stored });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * GET /recent - Liest die neuesten Timeline-Einträge
 */
router.get('/recent', (req, res) => {
  const limit = parseInt(req.query.limit) || 50;

  try {
    const entries = timelineStore.readRecent(limit);
    res.json({ entries, count: entries.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * GET /search - Durchsucht die Timeline semantisch
 */
router.get('/search', async (req, res) => {
  const { q } = req.query;
  const limit = parseInt(req.query.limit) || 10;

  if (!q) {
    return res.status(400).json({ error: 'q (Suchanfrage) muss angegeben werden' });
  }

  try {
    const result = await timelineLancedb.search(q, limit);

    if (result.reason === 'lancedb-unavailable') {
      return res.json({
        results: [],
        available: false,
        note: 'Semantische Suche erfordert @lancedb/lancedb (optionale Dependency, nicht installiert)'
      });
    }

    res.json({ results: result.results, available: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * GET /blacklist - Liest die aktuelle Blacklist
 */
router.get('/blacklist', (req, res) => {
  try {
    const apps = timelinePrivacy.getBlacklist();
    res.json({ apps });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * POST /blacklist - Setzt die gesamte Blacklist
 */
router.post('/blacklist', (req, res) => {
  const { apps } = req.body;

  if (!Array.isArray(apps)) {
    return res.status(400).json({ error: 'apps muss ein Array sein' });
  }

  try {
    const result = timelinePrivacy.setBlacklist(apps);
    res.json({ apps: result });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

/**
 * POST /blacklist/add - Fügt eine App zur Blacklist hinzu
 */
router.post('/blacklist/add', (req, res) => {
  const { app } = req.body;

  if (!app) {
    return res.status(400).json({ error: 'app muss angegeben werden' });
  }

  try {
    const result = timelinePrivacy.addToBlacklist(app);
    res.json({ apps: result });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

/**
 * POST /blacklist/remove - Entfernt eine App aus der Blacklist
 */
router.post('/blacklist/remove', (req, res) => {
  const { app } = req.body;

  if (!app) {
    return res.status(400).json({ error: 'app muss angegeben werden' });
  }

  try {
    const result = timelinePrivacy.removeFromBlacklist(app);
    res.json({ apps: result });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

/**
 * POST /delete-range - Löscht Timeline-Einträge in einem Zeitbereich
 */
router.post('/delete-range', async (req, res) => {
  const { from, to } = req.body;

  if (!from || !to) {
    return res.status(400).json({ error: 'from und to müssen angegeben werden' });
  }

  try {
    const ndjsonResult = timelineStore.deleteRange(from, to);
    const lancedbResult = await timelineLancedb.deleteRange(from, to);

    res.json({
      ndjson: ndjsonResult,
      lancedb: lancedbResult
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
