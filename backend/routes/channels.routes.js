/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
// (c) 2026 KI-OS.org by Ingo Schaffer und Kimba — AGPL-3.0-only
// @desc Channels API — Status/Start/Stop/Send für WhatsApp/Signal/iMessage (S4)

'use strict';

const express = require('express');
const router = express.Router();

// Lokale Registry der Kanal-Module
const CHANNELS = {
  whatsapp: require('../services/channels/whatsapp.channel.js'),
  signal: require('../services/channels/signal.channel.js'),
  imessage: require('../services/channels/imessage.channel.js')
};

/**
 * GET /status - Status aller Kanäle
 */
router.get('/status', async (req, res) => {
  try {
    const statusPromises = Object.values(CHANNELS).map(channel => channel.getStatus());
    const statusResults = await Promise.all(statusPromises);

    const result = {};
    Object.keys(CHANNELS).forEach((name, index) => {
      result[name] = statusResults[index];
    });

    res.json({ channels: result });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * GET /status/:name - Status eines bestimmten Kanals
 */
router.get('/status/:name', async (req, res) => {
  const { name } = req.params;

  if (!CHANNELS[name]) {
    return res.status(404).json({
      error: 'Unbekannter Kanal',
      name,
      available: Object.keys(CHANNELS)
    });
  }

  try {
    const status = await CHANNELS[name].getStatus();
    res.json({ name, status });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * POST /:name/start - Startet einen Kanal
 */
router.post('/:name/start', async (req, res) => {
  const { name } = req.params;

  if (!CHANNELS[name]) {
    return res.status(404).json({
      error: 'Unbekannter Kanal',
      name,
      available: Object.keys(CHANNELS)
    });
  }

  try {
    const result = await CHANNELS[name].start();
    res.json({ name, result });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * POST /:name/stop - Stoppt einen Kanal
 */
router.post('/:name/stop', async (req, res) => {
  const { name } = req.params;

  if (!CHANNELS[name]) {
    return res.status(404).json({
      error: 'Unbekannter Kanal',
      name,
      available: Object.keys(CHANNELS)
    });
  }

  try {
    const result = await CHANNELS[name].stop();
    res.json({ name, result });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * POST /:name/send - Sendet eine Nachricht über einen Kanal
 */
router.post('/:name/send', async (req, res) => {
  const { name } = req.params;
  const { to, text } = req.body;

  if (!to || !text) {
    return res.status(400).json({
      error: 'to und text müssen angegeben werden'
    });
  }

  if (!CHANNELS[name]) {
    return res.status(404).json({
      error: 'Unbekannter Kanal',
      name,
      available: Object.keys(CHANNELS)
    });
  }

  try {
    const result = await CHANNELS[name].sendMessage(to, text);
    res.json({ name, result });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
