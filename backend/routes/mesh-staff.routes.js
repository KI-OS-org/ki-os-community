/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
// (c) 2026 KI-OS.org by Ingo Schaffer und Kimba — AGPL-3.0-only

const express = require('express');
const router = express.Router();
const { getAllStaff } = require('../services/agentmesh/shadow-staff.config');

/**
 * GET /staff
 * Returns the complete Shadow Staff configuration.
 * No authentication required.
 */
router.get('/staff', (req, res) => {
  try {
    const staffList = getAllStaff();
    res.json(staffList);
  } catch (error) {
    console.error('Error fetching staff config:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

module.exports = router;