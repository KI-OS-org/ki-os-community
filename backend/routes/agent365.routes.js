/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
 /**
 * (c) 2026 KI-OS.org by Ingo Schaffer und Kimba
 * Datei: agent365.routes.js
 * HTTP-Routen für KIMBA Agent 365 — Microsoft Teams/Outlook/Word @Mention Receiver.
 * @license AGPL-3.0-only
 */

'use strict';

const express = require('express');
const agent365 = require('../services/agent365/agent365.service');
const router = express.Router();

// POST /message — Webhook-Eingang für @Mentions
router.post('/message', async (req, res) => {
  try {
    // Webhook-Signatur validieren
    const isValid = agent365.validateWebhook(req);
    if (!isValid) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Pflichtfeld-Validierung
    const { text } = req.body;
    if (!text) {
      return res.status(400).json({ error: 'Bad Request: text is required' });
    }

    // Mention verarbeiten
    const result = await agent365.handleMention(req.body);
    return res.status(200).json(result);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

// GET /manifest — Teams-App-Manifest
router.get('/manifest', (req, res) => {
  try {
    const manifest = agent365.getManifest();
    return res.status(200).json(manifest);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

// GET /status — Health-Check
router.get('/status', (req, res) => {
  res.status(200).json({
    ok: true,
    service: 'agent365',
    timestamp: Date.now()
  });
});

module.exports = router;