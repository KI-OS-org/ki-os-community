/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
// (c) 2026 KI-OS.org by Ingo Schaffer und Kimba — AGPL-3.0-only
// @desc Claws API — scan/install/uninstall/list/run für den ClawHub-Kompatibilitäts-Layer
'use strict';

const express = require('express');
const router = express.Router();
const { scanClaw, AMPEL } = require('../services/claws/claw.scanner.js');
const { installClaw, uninstallClaw, listInstalled, getInstalledClaw } = require('../services/claws/claw.installer.js');
const { runClaw, isDockerAvailable } = require('../services/claws/claw.sandbox.js');

router.post('/scan', async (req, res) => {
  const { path } = req.body;
  if (!path) {
    return res.status(400).json({ error: 'path muss angegeben werden' });
  }

  try {
    const result = scanClaw(path);
    res.json({ success: true, scan: result });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/install', async (req, res) => {
  const { path } = req.body;
  if (!path) {
    return res.status(400).json({ error: 'path muss angegeben werden' });
  }

  try {
    const result = await installClaw(path);
    res.json({ success: true, installed: result });
  } catch (e) {
    res.status(403).json({ success: false, error: e.message, blocked: true });
  }
});

router.delete('/uninstall/:name', async (req, res) => {
  try {
    const result = uninstallClaw(req.params.name);
    res.json({ success: true, ...result });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/list', (req, res) => {
  const installed = listInstalled();
  res.json({ installed, count: installed.length });
});

router.get('/docker-status', (req, res) => {
  const dockerAvailable = isDockerAvailable();
  res.json({ dockerAvailable });
});

router.post('/run/:name', async (req, res) => {
  const { name } = req.params;
  const { timeoutMs, confirm } = req.body;

  const claw = getInstalledClaw(name);
  if (!claw) {
    return res.status(404).json({ error: 'Claw nicht installiert', name });
  }

  try {
    // Defense-in-Depth: Re-Scan vor jeder Ausführung
    const rescan = scanClaw(claw.installedPath);

    if (rescan.ampel === AMPEL.RED) {
      return res.status(403).json({ success: false, blocked: true, reason: 'red-on-rerun', scan: rescan });
    }

    if (rescan.ampel === AMPEL.YELLOW && confirm !== true) {
      return res.status(409).json({ 
        success: false, 
        blocked: true, 
        reason: 'confirmation-required', 
        scan: rescan, 
        message: 'Claw hat gelbe Ampel — Ausführung erfordert confirm:true im Request-Body' 
      });
    }

    const execution = await runClaw(rescan.skill, { timeoutMs });
    res.json({ success: true, ampel: rescan.ampel, execution });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
