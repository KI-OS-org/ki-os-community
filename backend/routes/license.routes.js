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
const { getLicenseStatus, refreshLicenseOnline } = require('../services/license/license.service');

router.get('/status', (req, res) => {
  try {
    res.json({ success: true, data: getLicenseStatus() });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /license/refresh — Online-Validierung anstoßen
router.post('/refresh', async (req, res) => {
  try {
    const result = await refreshLicenseOnline();
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
