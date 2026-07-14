/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
// (c) 2026 KI-OS.org by Ingo Schaffer und Kimba — AGPL-3.0-only
'use strict';

exports.verifyWebhook = function(req, res) {
  if (req.query['hub.verify_token'] === process.env.META_WEBHOOK_VERIFY_TOKEN) {
    res.send(req.query['hub.challenge']);
  } else {
    res.status(403).send('Forbidden');
  }
};

exports.handleInbound = function(req, res) {
  res.sendStatus(200);
  setImmediate(async () => {
    const entry = req.body?.entry?.[0];
    const change = entry?.changes?.[0]?.value;
    const messages = change?.messages;
    if (!messages || messages.length === 0) return;
    const msg = messages[0];
    if (msg.type !== 'text') return;
    const from = msg.from;
    const body = msg.text.body;
    const parser = require('./whatsapp.parser');
    const seedDetector = require('./whatsapp.mission-seed');
    try {
      const parsed = await parser.parseInbound({ from, body, mediaUrl: null, mediaType: null });
      await seedDetector.detectMissionSeed(parsed);
    } catch (err) {
      console.error('[Meta Webhook]', err.message);
    }
  });
};
