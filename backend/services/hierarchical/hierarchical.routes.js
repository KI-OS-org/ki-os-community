/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
/**
 * KI-OS Hierarchical API Routes
 *
 * Endpoints:
 * - POST /api/hierarchical/run
 * - GET  /api/hierarchical/teams
 * - GET  /api/hierarchical/stats
 *
 * @license AGPL-3.0-only
 */
'use strict';

const express = require('express');
const controller = require('./hierarchical.controller');

const router = express.Router();

router.post('/run', controller.runHierarchical);
router.get('/teams', controller.getTeams);
router.get('/stats', controller.getStats);

module.exports = router;
