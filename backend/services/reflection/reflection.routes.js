/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
/**
 * KI-OS Reflection API Routes
 * 
 * RESTful Endpoints für Reflection.
 * 
 * @module services/reflection/reflection.routes.js
 * @license AGPL-3.0
 */

'use strict';

const express = require('express');
const reflectionController = require('./reflection.controller');

const router = express.Router();

/**
 * @swagger
 * /api/reflection/evaluate:
 *   post:
 *     summary: Agent-Run bewerten
 *     tags: [Reflection]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               runId: { type: string }
 *               task: { type: string }
 *               output: { type: string }
 *               actualCostUSD: { type: number }
 *               budgetCapUSD: { type: number }
 *               latencyMs: { type: number }
 */
router.post('/evaluate', reflectionController.evaluateRun);

/**
 * @swagger
 * /api/reflection/learnings:
 *   get:
 *     summary: Learnings holen
 *     tags: [Reflection]
 *     parameters:
 *       - in: query
 *         name: query
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: limit
 *         schema: { type: number, default: 10 }
 */
router.get('/learnings', reflectionController.getLearnings);

/**
 * @swagger
 * /api/reflection/stats:
 *   get:
 *     summary: Reflection-Stats
 *     tags: [Reflection]
 */
router.get('/stats', reflectionController.getStats);

module.exports = router;
