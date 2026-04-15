/**
 * Trust Center API Routes
 * 
 * RESTful Endpoints für Trust Center Operationen.
 * 
 * Endpoints:
 * - GET    /api/trust/approvals       - Pending Approvals holen
 * - GET    /api/trust/approvals/stats - Statistik holen
 * - POST   /api/trust/approve/:id     - Approval genehmigen
 * - POST   /api/trust/reject/:id      - Approval ablehnen
 * 
 * @module routes/trust.routes
 */

const express = require('express');
const router = express.Router();

const trustController = require('../controllers/trust.controller');

/**
 * @swagger
 * /api/trust/approvals:
 *   get:
 *     summary: Pending Approvals holen
 *     tags: [Trust]
 *     responses:
 *       200:
 *         description: Liste der pending Approvals
 */
router.get('/approvals', trustController.getPendingApprovals);

/**
 * @swagger
 * /api/trust/approvals/stats:
 *   get:
 *     summary: Approval Statistik holen
 *     tags: [Trust]
 *     responses:
 *       200:
 *         description: Statistik über Approvals
 */
router.get('/approvals/stats', trustController.getApprovalStats);

/**
 * @swagger
 * /api/trust/approve/{id}:
 *   post:
 *     summary: Approval genehmigen
 *     tags: [Trust]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Approval ID
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *                 description: Grund für die Genehmigung
 *     responses:
 *       200:
 *         description: Approval erfolgreich genehmigt
 *       403:
 *         description: Keine Berechtigung
 *       404:
 *         description: Approval nicht gefunden
 */
router.post('/approve/:id', trustController.approveApproval);

/**
 * @swagger
 * /api/trust/reject/{id}:
 *   post:
 *     summary: Approval ablehnen
 *     tags: [Trust]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Approval ID
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *                 description: Grund für die Ablehnung
 *     responses:
 *       200:
 *         description: Approval erfolgreich abgelehnt
 *       403:
 *         description: Keine Berechtigung
 *       404:
 *         description: Approval nicht gefunden
 */
router.post('/reject/:id', trustController.rejectApproval);

module.exports = router;
