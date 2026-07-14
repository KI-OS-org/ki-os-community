/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
// (c) 2026 KI-OS.org by Ingo Schaffer und Kimba — AGPL-3.0-only
'use strict';

const twilio = require('twilio');
const parser = require('./whatsapp.parser');
const seedDetector = require('./whatsapp.mission-seed');

async function handleInbound(req, res) {
  try {
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const url = process.env.TWILIO_WEBHOOK_URL || `${req.protocol}://${req.get('host')}${req.originalUrl}`;

    if (!twilio.validateRequest(authToken, req.headers['x-twilio-signature'], url, req.body)) {
      res.status(403).send('Forbidden');
      return;
    }

    const from = req.body.From;
    const body = req.body.Body || '';
    const mediaUrl = req.body.MediaUrl0 || null;
    const mediaType = req.body.MediaContentType0 || null;

    const parsed = await parser.parseInbound({ from, body, mediaUrl, mediaType });
    await seedDetector.detectMissionSeed(parsed);

    res.setHeader('Content-Type', 'text/xml');
    res.send('<Response></Response>');
  } catch (error) {
    console.error('WhatsApp webhook error:', error);
    res.status(500).send('<Response></Response>');
  }
}

module.exports = { handleInbound };
