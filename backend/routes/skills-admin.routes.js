/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
// (c) 2026 KI-OS.org by Ingo Schaffer und Kimba — AGPL-3.0-only
// @desc Skills Admin API — install/uninstall/catalog für externe Skills (vJ4)
'use strict';

const express = require('express');
const router = express.Router();
const { installSkill, uninstallSkill, listInstalled } = require('../services/skills/skill.installer');
const { readManifest } = require('../services/skills/skill.manifest');
const path = require('path');

const EXTERNAL_DIR = process.env.SKILLS_EXTERNAL_DIR || path.join(__dirname, '../../skills/external');
const MANIFEST = path.join(EXTERNAL_DIR, 'installed.json');

router.post('/install', async (req, res) => {
  const { source } = req.body;
  if (!source) {
    return res.status(400).json({ error: 'Quelle (source) muss angegeben werden' });
  }
  
  try {
    const result = await installSkill(source, { externalDir: EXTERNAL_DIR, manifestPath: MANIFEST });
    res.json({ success: true, installed: result });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.delete('/uninstall/:name', async (req, res) => {
  try {
    await uninstallSkill(req.params.name, EXTERNAL_DIR, MANIFEST);
    res.json({ success: true, removed: req.params.name });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.get('/catalog', (req, res) => {
  const installed = listInstalled(EXTERNAL_DIR, MANIFEST);
  res.json({ installed, count: installed.length });
});

router.get('/installed', (req, res) => {
  try {
    const entries = readManifest(MANIFEST);
    res.json({ installed: entries, count: entries.length });
  } catch (e) {
    res.status(500).json({ error: 'Konnte Manifest-Datei nicht lesen' });
  }
});

module.exports = router;
