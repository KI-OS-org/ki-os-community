/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
// (c) 2026 KI-OS.org by Ingo Schaffer und Kimba — AGPL-3.0-only
'use strict';

const router = require('express').Router();
const governance = require('../services/governance/governance.module');

// GET /api/governance/status — Governance-Status abrufen
router.get('/status', (req, res) => {
  try {
    res.json(governance.getGovernanceStatus());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/governance/policy — Policy-Pack der aktuellen Edition
router.get('/policy', (req, res) => {
  try {
    res.json(governance.getPolicyPack());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/governance/audit — Audit-Event schreiben
router.post('/audit', (req, res) => {
  try {
    const { runId, event, metadata } = req.body || {};
    if (!runId || !event) {
      return res.status(400).json({ error: 'runId und event sind erforderlich' });
    }
    governance.auditEvent(runId, event, metadata);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
