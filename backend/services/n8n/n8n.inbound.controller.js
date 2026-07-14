/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
/**
 * (c) 2026 KI-OS.org by Ingo Schaffer und Kimba
 * Datei: n8n.inbound.controller.js
 * Express Controller fuer inbound Webhooks von n8n.
 * @license AGPL-3.0-only
 */
const { env } = process;
const crypto = require('crypto');
const express = require('express');
const router = express.Router();
const n8nSidecar = require('./n8n.sidecar.service');

const N8N_WEBHOOK_SECRET = env.N8N_WEBHOOK_SECRET;

const verifySignature = (signature, body) => {
  if (!N8N_WEBHOOK_SECRET) {
    console.warn('n8n_webhook_no_secret');
    return true;
  }

  const hash = crypto.createHmac('sha256', N8N_WEBHOOK_SECRET).update(body).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(hash));
};

router.post('/n8n/webhook/:event', (req, res) => {
  const { event } = req.params;
  const { body } = req;
  const signature = req.get('X-N8N-Signature');

  if (!verifySignature(signature, JSON.stringify(body))) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  n8nSidecar.emitInbound(event, body);
  res.json({ received: true, event });
});

router.get('/n8n/status', async (req, res) => {
  try {
    const status = await n8nSidecar.getStatus();
    res.json(status);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/n8n/workflows', async (req, res) => {
  try {
    const workflows = await n8nSidecar.listWorkflows();
    res.json(workflows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/n8n/workflows/:id/trigger', async (req, res) => {
  const { id } = req.params;
  const { body } = req;

  try {
    const response = await n8nSidecar.triggerWorkflow(id, body);
    res.json(response);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/n8n/callbacks', (req, res) => {
  const events = n8nSidecar.getCallbackRegistry();
  res.json(events);
});

module.exports = router;