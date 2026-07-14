/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
// (c) 2026 KI-OS.org by Ingo Schaffer und Kimba — AGPL-3.0-only
'use strict';

const express = require('express');
const router = express.Router();
const { compress, getCapsule, listCapsules } = require('../services/presence/decision.compression');
const { getModelInfo } = require('../services/presence/decision.model-router');
const { scoreDecision } = require('../services/presence/decision.scorer');

/**
 * POST /api/decisions/compress/:warRoomId
 * Compresses a War Room into a Decision Capsule
 */
router.post('/compress/:warRoomId', async (req, res) => {
    try {
        const warRoomId = parseInt(req.params.warRoomId);
        if (isNaN(warRoomId)) {
            return res.status(400).json({ error: 'Invalid warRoomId' });
        }

        const decisionCapsule = await compress(warRoomId);
        res.json(decisionCapsule);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/decisions/capsule/:warRoomId
 * Retrieves a Decision Capsule by War Room ID
 */
router.get('/capsule/:warRoomId', (req, res) => {
    try {
        const warRoomId = parseInt(req.params.warRoomId);
        if (isNaN(warRoomId)) {
            return res.status(400).json({ error: 'Invalid warRoomId' });
        }

        const capsule = getCapsule(warRoomId);
        if (!capsule) {
            return res.status(404).json({ error: 'Decision Capsule not found' });
        }

        res.json(capsule);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/decisions/capsules
 * Lists all Decision Capsules
 */
router.get('/capsules', (req, res) => {
    try {
        const capsules = listCapsules();
        res.json(capsules);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/decisions/models
 * Returns information about available decision models
 */
router.get('/models', (req, res) => {
    try {
        const models = getModelInfo();
        res.json(models);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST /api/decisions/score
 * Scores a decision based on the provided warRoom object
 */
router.post('/score', (req, res) => {
    try {
        if (!req.body || typeof req.body !== 'object') {
            return res.status(400).json({ error: 'Invalid request body' });
        }

        const scores = scoreDecision(req.body);
        res.json(scores);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
