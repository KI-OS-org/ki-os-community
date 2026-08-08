/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
/**
 * (c) 2026 KI-OS.org by Ingo Schaffer und Kimba
 * @file    tower.routes.js
 * @desc    HTTP-API für Control Tower — Runs, Costs, Connectors, Policy + Kostenbremse.
 * @license AGPL-3.0-only
 */
'use strict';
const router = require('express').Router();
const tower  = require('../services/tower/tower.service');

router.get('/runs', async (req, res) => {
  try {
    const limit = req.query.limit ? Number(req.query.limit) : 20;
    const status = req.query.status || undefined;
    if (req.query.limit && !Number.isFinite(limit)) return res.status(400).json({ error: 'limit ungültig' });
    const runs = await Promise.resolve(tower.getRuns({ limit, status }));
    const stats = await Promise.resolve(tower.getRunStats());
    res.json({ runs, stats });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/costs', async (req, res) => {
  try {
    const limit = req.query.limit ? Number(req.query.limit) : 50;
    if (req.query.limit && !Number.isFinite(limit)) return res.status(400).json({ error: 'limit ungültig' });
    const overview = await tower.getCostOverview(limit);
    res.json(overview);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/tower/costs/session — Session-Kosten mit Budget-Status
router.get('/costs/session', async (req, res) => {
  try {
    res.json(tower.getSessionCosts());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/tower/costs/session — Session-Kosten zurücksetzen
router.delete('/costs/session', async (req, res) => {
  try {
    res.json(tower.resetSessionCosts());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/tower/costs/live — Letzte LLM-Call Events
router.get('/costs/live', async (req, res) => {
  try {
    const limit = Number(req.query.limit) || 50;
    res.json({ events: tower.getLiveEvents(limit) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/connectors', async (req, res) => {
  try {
    const overview = await Promise.resolve(tower.getConnectors());
    res.json(overview);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/policy', async (req, res) => {
  try {
    res.json({ policy: await Promise.resolve(tower.getPolicy()) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/policy/override', async (req, res) => {
  try {
    const body = req.body || {};
    const hasField = ['modelLock', 'budgetCapUSD', 'agentStop', 'reason'].some((key) => Object.prototype.hasOwnProperty.call(body, key));
    if (!hasField) return res.status(400).json({ error: 'Override-Daten fehlen' });
    res.json({ policy: await Promise.resolve(tower.setOverride(body)), message: 'Override aktiv' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/policy/override', async (req, res) => {
  try {
    res.json({ policy: await Promise.resolve(tower.clearOverride()), message: 'Override gelöscht' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
