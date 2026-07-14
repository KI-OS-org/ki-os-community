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
const webhook = require('../services/whatsapp/whatsapp.webhook');
const Database = require('better-sqlite3');
const path = require('path');

router.post('/inbound', express.urlencoded({ extended: false }), webhook.handleInbound);

router.get('/seeds', (req, res) => {
  try {
    const db = new Database(process.env.PRESENCE_DB_PATH || path.join(process.cwd(), 'data', 'kimba.db'));
    const rows = db.prepare('SELECT * FROM kimba_mission_seeds ORDER BY created_at DESC LIMIT 50').all();
    res.json(rows);
  } catch (err) {
    res.json([]);
  }
});

module.exports = router;
