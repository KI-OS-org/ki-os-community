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
const inbox = require('../services/presence/mission.inbox');
const warRoom = require('../services/presence/mission.war-room');

// GET /api/missions/inbox
router.get('/inbox', async (req, res) => {
  try {
    const inboxData = await inbox.getInbox();
    res.json(inboxData);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/missions/seeds
router.get('/seeds', async (req, res) => {
  try {
    const { status } = req.query;
    let seeds = [];

    // In a real implementation, you would query the database based on the status
    // For now, we'll just return all seeds from the inbox
    const inboxData = await inbox.getInbox();

    if (status === 'pending') {
      seeds = inboxData.pending;
    } else if (status === 'confirmed') {
      // In a real implementation, you would query the database for confirmed seeds
      // For now, we'll return an empty array as confirmed seeds are in war rooms
      seeds = [];
    } else if (status === 'dismissed') {
      // In a real implementation, you would query the database for dismissed seeds
      // For now, we'll return an empty array
      seeds = [];
    } else {
      // Return all seeds from the inbox
      seeds = [...inboxData.pending];
    }

    res.json(seeds);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/missions/seeds/:id/confirm
router.post('/seeds/:id/confirm', async (req, res) => {
  try {
    const seedId = parseInt(req.params.id);
    if (isNaN(seedId)) {
      return res.status(400).json({ error: 'Invalid seed ID' });
    }

    const warRoomCreated = await inbox.confirmSeed(seedId);
    res.json(warRoomCreated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/missions/seeds/:id/dismiss
router.post('/seeds/:id/dismiss', async (req, res) => {
  try {
    const seedId = parseInt(req.params.id);
    if (isNaN(seedId)) {
      return res.status(400).json({ error: 'Invalid seed ID' });
    }

    const dismissedSeed = await inbox.dismissSeed(seedId);
    res.json(dismissedSeed);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/missions/warrooms
router.get('/warrooms', async (req, res) => {
  try {
    const { status, priority } = req.query;
    const filters = {};

    if (status) {
      filters.status = status;
    }

    if (priority) {
      filters.priority = priority;
    }

    const warRooms = warRoom.getAll(filters);
    res.json(warRooms);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/missions/warrooms/:id
router.get('/warrooms/:id', async (req, res) => {
  try {
    const warRoomId = parseInt(req.params.id);
    if (isNaN(warRoomId)) {
      return res.status(400).json({ error: 'Invalid war room ID' });
    }

    const warRoomData = warRoom.getById(warRoomId);
    if (!warRoomData) {
      return res.status(404).json({ error: 'War room not found' });
    }

    res.json(warRoomData);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/missions/warrooms/:id
router.patch('/warrooms/:id', async (req, res) => {
  try {
    const warRoomId = parseInt(req.params.id);
    if (isNaN(warRoomId)) {
      return res.status(400).json({ error: 'Invalid war room ID' });
    }

    const updatedWarRoom = warRoom.update(warRoomId, req.body);
    if (!updatedWarRoom) {
      return res.status(404).json({ error: 'War room not found' });
    }

    res.json(updatedWarRoom);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/missions/warrooms/:id/decision
router.post('/warrooms/:id/decision', async (req, res) => {
  try {
    const warRoomId = parseInt(req.params.id);
    if (isNaN(warRoomId)) {
      return res.status(400).json({ error: 'Invalid war room ID' });
    }

    const { text, author } = req.body;
    if (!text || !author) {
      return res.status(400).json({ error: 'Decision text and author are required' });
    }

    const updatedWarRoom = warRoom.addDecision(warRoomId, { text, author });
    res.json(updatedWarRoom);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/missions/warrooms/:id/next-step
router.post('/warrooms/:id/next-step', async (req, res) => {
  try {
    const warRoomId = parseInt(req.params.id);
    if (isNaN(warRoomId)) {
      return res.status(400).json({ error: 'Invalid war room ID' });
    }

    const { step } = req.body;
    if (!step) {
      return res.status(400).json({ error: 'Next step is required' });
    }

    const updatedWarRoom = warRoom.addNextStep(warRoomId, step);
    res.json(updatedWarRoom);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/missions/warrooms/:id/close
router.post('/warrooms/:id/close', async (req, res) => {
  try {
    const warRoomId = parseInt(req.params.id);
    if (isNaN(warRoomId)) {
      return res.status(400).json({ error: 'Invalid war room ID' });
    }

    const closedWarRoom = warRoom.close(warRoomId);
    res.json(closedWarRoom);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/missions/stream (SSE)
router.get('/stream', (req, res) => {
  // Set headers for SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  // Send a heartbeat every 15 seconds to keep the connection alive
  const heartbeatInterval = setInterval(() => {
    res.write(': heartbeat\n\n');
  }, 15000);

  // Event handlers
  const onMissionNew = (mission) => {
    res.write(`event: mission:new\ndata: ${JSON.stringify(mission)}\n\n`);
  };

  const onWarRoomCreated = (warRoom) => {
    res.write(`event: warroom:created\ndata: ${JSON.stringify(warRoom)}\n\n`);
  };

  // Register event listeners
  inbox.on('mission:new', onMissionNew);
  inbox.on('warroom:created', onWarRoomCreated);

  // Clean up on client disconnect
  req.on('close', () => {
    clearInterval(heartbeatInterval);
    inbox.off('mission:new', onMissionNew);
    inbox.off('warroom:created', onWarRoomCreated);
    res.end();
  });
});

// POST /api/missions/process
router.post('/process', async (req, res) => {
  try {
    const result = await inbox.processLatestEvents();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
