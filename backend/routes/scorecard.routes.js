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
const scorecard = require('../services/core/outcome.scorecard');

router.get('/scorecard', (req, res) => {
  res.json(scorecard.getScorecard());
});

router.post('/scorecard/record', (req, res) => {
  const { provider, taskType, score, costUsd } = req.body || {};
  res.json(scorecard.recordOutcome(provider, taskType, score, costUsd));
});

router.get('/scorecard/recommend', (req, res) => {
  const { taskType, maxCostUsd } = req.query || {};
  res.json(scorecard.getRecommendation(taskType, maxCostUsd));
});

module.exports = router;
