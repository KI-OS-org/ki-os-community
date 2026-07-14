/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
// (c) 2026 KI-OS.org by Ingo Schaffer und Kimba — AGPL-3.0-only
'use strict';

const router = require('express').Router();
const agent = require('../services/presence/presence.agent');
const { PRESENCE_STATES, MENUBAR_COLORS } = require('../schemas/presence.schema');

router.get('/state', (req, res) => {
  try {
    res.json(agent.getState());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/override', (req, res) => {
  const { state } = req.body;

  if (!Object.values(PRESENCE_STATES).includes(state)) {
    return res.status(400).json({ error: `Unbekannter State: ${state}` });
  }

  const since = new Date().toISOString();
  agent._currentState = { state, confidence: 1.0, since, color: MENUBAR_COLORS[state] };
  agent.emit('state:changed', agent._currentState);

  res.json({ ok: true, state, since });
});

router.get('/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  res.write(`data: ${JSON.stringify({ connected: true })}\n\n`);

  const heartbeatMs = parseInt(process.env.PRESENCE_SSE_HEARTBEAT_MS, 10) || 15000;
  const heartbeat = setInterval(() => {
    res.write(`: heartbeat ${Date.now()}\n\n`);
  }, heartbeatMs);

  const onChange = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);

  agent.on('state:changed', onChange);
  agent.on('state:tick', onChange);

  req.on('close', () => {
    clearInterval(heartbeat);
    agent.off('state:changed', onChange);
    agent.off('state:tick', onChange);
  });
});

module.exports = router;
