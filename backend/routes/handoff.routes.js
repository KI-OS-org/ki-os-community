/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
/**
 * (c) 2026 KI-OS.org — Handoff Routes
 * HTTP-Endpoints für AgentMesh Handoff-Reports
 */
'use strict';

const express = require('express');
const router = express.Router();
const handoff = require('../services/agentmesh/handoff.service');

/**
 * GET /handoff/:runId
 * Liefert Handoff-Report für gegebenen Run
 */
router.get('/:runId', async (req, res) => {
  try {
    const result = handoff.createHandoff(req.params.runId);
    res.json(result);
  } catch (error) {
    if (error.message.startsWith('Run not found:')) {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
