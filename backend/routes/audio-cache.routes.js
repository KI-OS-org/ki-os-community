/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
// (c) 2026 KI-OS.org by Ingo Schaffer und Kimba — AGPL-3.0-only
// @desc REST-API für KIMBA Audio-Cache — Stats, Suche, Einträge, Katalog
'use strict';

const router = require('express').Router();
const audioCache = require('../services/audio/audio-cache.service');
const audioCatalog = require('../services/audio/audio-catalog');
const path = require('path');

/**
 * GET /api/audio-cache/stats
 * Returns cache statistics including readiness, entry count, top played items and cache directory
 */
router.get('/stats', async (req, res) => {
  try {
    const ready = audioCache.isReady();
    const entries = await audioCache.getAll();
    const topPlayed = entries
      .sort((a, b) => b.playCount - a.playCount)
      .slice(0, 5)
      .map(({ text, playCount }) => ({ text, playCount }));

    res.json({
      ready,
      entryCount: entries.length,
      topPlayed,
      cacheDir: path.join(__dirname, '../../audio-cache')
    });
  } catch (error) {
    console.error('Error fetching cache stats:', error);
    res.status(500).json({ error: 'Failed to fetch cache statistics' });
  }
});

/**
 * GET /api/audio-cache/entries
 * Returns filtered audio cache entries based on mood and language
 */
router.get('/entries', async (req, res) => {
  try {
    const { mood, lang } = req.query;
    const entries = await audioCache.getAll();

    const filtered = entries.filter(entry => {
      const moodMatch = !mood || entry.mood === mood;
      const langMatch = !lang || entry.lang === lang;
      return moodMatch && langMatch;
    });

    res.json({ entries: filtered });
  } catch (error) {
    console.error('Error fetching cache entries:', error);
    res.status(500).json({ error: 'Failed to fetch cache entries' });
  }
});

/**
 * POST /api/audio-cache/search
 * Searches for audio cache entries matching the given text, mood and language
 */
router.post('/search', async (req, res) => {
  try {
    const { text, mood, lang } = req.body;
    const result = await audioCache.search(text, { mood, lang });

    res.json({
      hit: !!result,
      score: result?.score || 0,
      result: result || null
    });
  } catch (error) {
    console.error('Error searching cache:', error);
    res.status(500).json({ error: 'Failed to search cache' });
  }
});

/**
 * DELETE /api/audio-cache/clear
 * Clears all audio cache entries (metadata only)
 */
router.delete('/clear', async (req, res) => {
  try {
    const entries = await audioCache.getAll();

    await audioCache.clear();
    res.json({
      cleared: true,
      cleared_count: entries.length,
      message: `${entries.length} Einträge gelöscht.`
    });
  } catch (error) {
    console.error('Error clearing cache:', error);
    res.status(500).json({ error: 'Failed to clear cache' });
  }
});

/**
 * GET /api/audio-cache/catalog
 * Returns the available audio catalog
 */
router.get('/catalog', async (req, res) => {
  try {
    const catalog = audioCatalog.getCatalogForSeed();
    res.json({
      count: catalog.length,
      catalog
    });
  } catch (error) {
    console.error('Error fetching catalog:', error);
    res.status(500).json({ error: 'Failed to fetch catalog' });
  }
});

module.exports = router;
