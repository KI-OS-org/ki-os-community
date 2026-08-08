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

// Import der benötigten Services
const signalRouter = require('../services/presence/signal.router');
const interruptScheduler = require('../services/presence/interrupt.scheduler');
const channelRegistry = require('../services/presence/channel.registry');

// ─── GET /api/signals/status ─────────────────────────────────────────────────
router.get('/status', (req, res) => {
  try {
    const queueStatus = interruptScheduler.getQueueStatus();

    res.json({
      router: {
        suppressedCount: signalRouter.getSuppressedCount()
      },
      scheduler: {
        count: queueStatus.count,
        oldestMs: queueStatus.oldestMs
      },
      policy: 'active'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/signals/route ─────────────────────────────────────────────────
router.post('/route', (req, res) => {
  try {
    const { signal, state } = req.body;

    if (!signal || !state) {
      return res.status(400).json({ error: 'Missing signal or state in request body' });
    }

    const routingResult = signalRouter.routeSignal(signal, state);
    res.json(routingResult);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/signals/queue ──────────────────────────────────────────────────
router.get('/queue', (req, res) => {
  try {
    const queueStatus = interruptScheduler.getQueueStatus();
    res.json(queueStatus);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/signals/flush ─────────────────────────────────────────────────
router.post('/flush', (req, res) => {
  try {
    const { state } = req.body;

    if (!state) {
      return res.status(400).json({ error: 'Missing state in request body' });
    }

    const result = interruptScheduler.onStateChange(state);
    res.json({ flushed: result.flushed });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/signals/channels ───────────────────────────────────────────────
router.get('/channels', (req, res) => {
  try {
    const channels = channelRegistry.getAllChannels();
    res.json(channels);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/signals/stream (SSE) ───────────────────────────────────────────
router.get('/stream', (req, res) => {
  // Setze SSE-Header
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  // Heartbeat-Interval
  const heartbeatInterval = setInterval(() => {
    res.write(': heartbeat\n\n');
  }, 15000);

  // Event-Handler für Scheduler-Events
  const onDispatch = (data) => {
    res.write(`event: signal:dispatch\ndata: ${JSON.stringify(data)}\n\n`);
  };

  const onFlush = (data) => {
    res.write(`event: signal:flush\ndata: ${JSON.stringify(data)}\n\n`);
  };

  const onDropped = (data) => {
    res.write(`event: signal:dropped\ndata: ${JSON.stringify(data)}\n\n`);
  };

  // Registriere Event-Handler
  interruptScheduler.on('signal:dispatch', onDispatch);
  interruptScheduler.on('signal:flush', onFlush);
  interruptScheduler.on('signal:dropped', onDropped);

  // Cleanup bei Client-Verbindungsschluss
  req.on('close', () => {
    clearInterval(heartbeatInterval);
    interruptScheduler.off('signal:dispatch', onDispatch);
    interruptScheduler.off('signal:flush', onFlush);
    interruptScheduler.off('signal:dropped', onDropped);
    res.end();
  });
});

module.exports = router;
