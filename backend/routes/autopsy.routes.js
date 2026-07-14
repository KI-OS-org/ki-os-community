/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
// (c) 2026 KI-OS.org by Ingo Schaffer und Kimba — AGPL-3.0-only

const express = require('express');
const { generateAutopsy, getAutopsies } = require('../services/intelligence/autopsy.service');

const router = express.Router();

// GET / - List autopsies for user
router.get('/', async (req, res, next) => {
  try {
    const userId = req.user?.id || 'default';
    const limit = parseInt(req.query.limit) || 10;
    const autopsies = getAutopsies(userId, limit);
    res.json(autopsies);
  } catch (err) {
    console.error('Autopsy List Error:', err);
    next(err);
  }
});

// GET /:runId - Generate autopsy for specific run
router.get('/:runId', async (req, res, next) => {
  try {
    const runId = req.params.runId;
    const userId = req.user?.id || 'default';
    
    const result = await generateAutopsy(runId, userId);
    res.json(result);
  } catch (err) {
    if (err.message === 'Run not found') {
      return res.status(404).json({ error: 'Run not found' });
    }
    console.error('Autopsy Generation Error:', err);
    next(err);
  }
});

module.exports = router;