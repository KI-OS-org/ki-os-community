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
const manager = require('../services/earpiece/earpiece.manager').getInstance();

// GET /api/earpiece/status
router.get('/status', (req, res) => {
  try {
    const status = manager.getStatus();
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/earpiece/meeting/start
router.post('/meeting/start', async (req, res) => {
  try {
    const { title, startTime, participants } = req.body;
    if (!title || !startTime || !participants) {
      return res.status(400).json({ error: 'Missing required fields: title, startTime, participants' });
    }

    await manager.startMeeting();
    res.json({ ok: true, state: 'ACTIVE' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/earpiece/meeting/pre
router.post('/meeting/pre', async (req, res) => {
  try {
    const { title, startTime, participants } = req.body;
    if (!title || !startTime || !participants) {
      return res.status(400).json({ error: 'Missing required fields: title, startTime, participants' });
    }

    const meetingContext = { title, startTime, participants };
    await manager.startPreMeeting(meetingContext);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/earpiece/meeting/end
router.post('/meeting/end', async (req, res) => {
  try {
    const report = await manager.endMeeting();
    res.json(report);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/earpiece/whisper
router.post('/whisper', async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) {
      return res.status(400).json({ error: 'Missing required field: text' });
    }

    const response = await manager.handleUserWhisper(text);
    res.json(response);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/earpiece/stream (SSE)
router.get('/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  // Heartbeat every 15 seconds
  const heartbeatInterval = setInterval(() => {
    res.write(`event: heartbeat\ndata: ${JSON.stringify({ ts: new Date().toISOString() })}\n\n`);
  }, 15000);

  // Event listeners
  const whisperSentListener       = (d) => res.write(`event: whisper:sent\ndata: ${JSON.stringify(d)}\n\n`);
  const whisperSuppressedListener = (d) => res.write(`event: whisper:suppressed\ndata: ${JSON.stringify(d)}\n\n`);
  const meetingStartedListener    = (d) => res.write(`event: meeting:started\ndata: ${JSON.stringify(d)}\n\n`);
  const meetingEndedListener      = (d) => res.write(`event: meeting:ended\ndata: ${JSON.stringify(d)}\n\n`);

  // Emotion Observer Events — stimmbasiert getriggert oder periodisch
  const emotionUpdateListener = (d) => res.write(`event: emotion:update\ndata: ${JSON.stringify(d)}\n\n`);
  const emotionAlertListener  = (d) => res.write(`event: emotion:alert\ndata: ${JSON.stringify(d)}\n\n`);

  manager.on('whisper:sent',       whisperSentListener);
  manager.on('whisper:suppressed', whisperSuppressedListener);
  manager.on('meeting:started',    meetingStartedListener);
  manager.on('meeting:ended',      meetingEndedListener);
  manager.on('emotion:update',     emotionUpdateListener);
  manager.on('emotion:alert',      emotionAlertListener);

  // Cleanup on client disconnect
  req.on('close', () => {
    clearInterval(heartbeatInterval);
    manager.off('whisper:sent',       whisperSentListener);
    manager.off('whisper:suppressed', whisperSuppressedListener);
    manager.off('meeting:started',    meetingStartedListener);
    manager.off('meeting:ended',      meetingEndedListener);
    manager.off('emotion:update',     emotionUpdateListener);
    manager.off('emotion:alert',      emotionAlertListener);
    res.end();
  });
});

// GET /api/earpiece/transcript
router.get('/transcript', (req, res) => {
  try {
    const status = manager.getStatus();
    const lastSegments = status.bufferStats.lastSegments || [];

    res.json({
      bufferStats: status.bufferStats,
      lastSegments: lastSegments.slice(-5) // Get last 5 segments
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
