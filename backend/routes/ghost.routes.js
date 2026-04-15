/**
 * Ghost Control — API Routes
 * 
 * RESTful Endpoints für Ghost Control.
 * 
 * Endpoints:
 * - POST   /api/ghost/plan                 - GhostPlan generieren
 * - POST   /api/ghost/execute              - Plan/Step ausführen
 * - GET    /api/ghost/session/:id          - Session-Status
 * - POST   /api/ghost/session/:id/confirm  - User-Confirmation
 * - GET    /api/ghost/history              - Session History
 * 
 * @module routes/ghost.routes.js
 */

const express = require('express');
const router = express.Router();

const ghostController = require('../controllers/ghost.controller');

/**
 * @swagger
 * /api/ghost/plan:
 *   post:
 *     summary: GhostPlan generieren
 *     tags: [Ghost Control]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               goal:
 *                 type: string
 *                 description: User-Ziel (z.B. "Erstelle einen Agenten")
 *               mode:
 *                 type: string
 *                 enum: [demo, build]
 *                 default: demo
 *     responses:
 *       200:
 *         description: GhostPlan generiert
 */
router.post('/plan', ghostController.generatePlan);

/**
 * @swagger
 * /api/ghost/execute:
 *   post:
 *     summary: GhostPlan oder Step ausführen
 *     tags: [Ghost Control]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               plan:
 *                 type: object
 *               stepId:
 *                 type: string
 *               context:
 *                 type: object
 *     responses:
 *       200:
 *         description: Execution erfolgreich
 */
router.post('/execute', ghostController.execute);

/**
 * @swagger
 * /api/ghost/session/{sessionId}:
 *   get:
 *     summary: Session-Status holen
 *     tags: [Ghost Control]
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Session-Status
 */
router.get('/session/:sessionId', ghostController.getSession);

/**
 * @swagger
 * /api/ghost/session/{sessionId}/confirm:
 *   post:
 *     summary: User-Confirmation für Step
 *     tags: [Ghost Control]
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               stepId:
 *                 type: string
 *               confirmed:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Confirmation gespeichert
 */
router.post('/session/:sessionId/confirm', ghostController.confirmStep);

/**
 * @swagger
 * /api/ghost/history:
 *   get:
 *     summary: Ghost Session History
 *     tags: [Ghost Control]
 *     responses:
 *       200:
 *         description: Session History
 */
router.get('/history', ghostController.getHistory);

module.exports = router;
