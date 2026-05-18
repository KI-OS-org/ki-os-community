/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
/**
 * KI-OS A2A API Routes
 * 
 * RESTful Endpoints für Agent-zu-Agent-Kommunikation.
 * 
 * Endpoints:
 * - POST   /api/a2a/agents                — Agent registrieren
 * - DELETE /api/a2a/agents/:id            — Agent abmelden
 * - GET    /api/a2a/agents                — Alle Agents
 * - GET    /api/a2a/agents/:id            — Agent-Details
 * - GET    /api/a2a/agents/capabilities/:capability — Agents mit Capability
 * - POST   /api/a2a/agents/:id/heartbeat  — Heartbeat
 * - PATCH  /api/a2a/agents/:id/status     — Status aktualisieren
 * - POST   /api/a2a/send                  — Nachricht senden
 * - POST   /api/a2a/broadcast             — Broadcast
 * - GET    /api/a2a/messages/:agentId     — Nachrichten für Agent
 * - DELETE /api/a2a/messages/:id          — Als gelesen markieren
 * - POST   /api/a2a/messages/:id/complete — Als abgeschlossen markieren
 * - GET    /api/a2a/stats                 — Stats
 * 
 * @module routes/a2a.routes
 * @license AGPL-3.0
 */

'use strict';

const express = require('express');
const a2aController = require('../controllers/a2a.controller');

const router = express.Router();

/**
 * @swagger
 * /api/a2a/agents:
 *   post:
 *     summary: Agent registrieren
 *     tags: [A2A]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               type: { type: string }
 *               capabilities: { type: array, items: { type: string } }
 */
router.post('/agents', a2aController.registerAgent);

/**
 * @swagger
 * /api/a2a/agents/{id}:
 *   delete:
 *     summary: Agent abmelden
 *     tags: [A2A]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 */
router.delete('/agents/:id', a2aController.unregisterAgent);

/**
 * @swagger
 * /api/a2a/agents:
 *   get:
 *     summary: Alle Agents holen
 *     tags: [A2A]
 */
router.get('/agents', a2aController.getAllAgents);

/**
 * @swagger
 * /api/a2a/agents/{id}:
 *   get:
 *     summary: Agent-Details
 *     tags: [A2A]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 */
router.get('/agents/:id', a2aController.getAgent);

/**
 * @swagger
 * /api/a2a/agents/capabilities/{capability}:
 *   get:
 *     summary: Agents mit Capability
 *     tags: [A2A]
 *     parameters:
 *       - in: path
 *         name: capability
 *         required: true
 *         schema: { type: string }
 */
router.get('/agents/capabilities/:capability', a2aController.getAgentsByCapability);

/**
 * @swagger
 * /api/a2a/agents/{id}/heartbeat:
 *   post:
 *     summary: Heartbeat senden
 *     tags: [A2A]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 */
router.post('/agents/:id/heartbeat', a2aController.heartbeat);

/**
 * @swagger
 * /api/a2a/agents/{id}/status:
 *   patch:
 *     summary: Status aktualisieren
 *     tags: [A2A]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status: { type: string, enum: [active, busy, offline] }
 */
router.patch('/agents/:id/status', a2aController.updateAgentStatus);

/**
 * @swagger
 * /api/a2a/send:
 *   post:
 *     summary: Nachricht senden
 *     tags: [A2A]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               from: { type: string }
 *               to: { type: string }
 *               type: { type: string }
 *               payload: { type: object }
 */
router.post('/send', a2aController.sendMessage);

/**
 * @swagger
 * /api/a2a/broadcast:
 *   post:
 *     summary: Broadcast an alle Agents
 *     tags: [A2A]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               from: { type: string }
 *               type: { type: string }
 *               payload: { type: object }
 */
router.post('/broadcast', a2aController.broadcast);

/**
 * @swagger
 * /api/a2a/messages/{agentId}:
 *   get:
 *     summary: Nachrichten für Agent
 *     tags: [A2A]
 *     parameters:
 *       - in: path
 *         name: agentId
 *         required: true
 *         schema: { type: string }
 */
router.get('/messages/:agentId', a2aController.getMessages);

/**
 * @swagger
 * /api/a2a/messages/{id}:
 *   delete:
 *     summary: Als gelesen markieren
 *     tags: [A2A]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 */
router.delete('/messages/:id', a2aController.acknowledgeMessage);

/**
 * @swagger
 * /api/a2a/messages/{id}/complete:
 *   post:
 *     summary: Als abgeschlossen markieren
 *     tags: [A2A]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               result: { type: object }
 */
router.post('/messages/:id/complete', a2aController.completeMessage);

/**
 * @swagger
 * /api/a2a/stats:
 *   get:
 *     summary: A2A-Stats
 *     tags: [A2A]
 */
router.get('/stats', a2aController.getStats);

module.exports = router;
