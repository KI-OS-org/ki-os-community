/**
 * Strategy API Routes
 * 
 * RESTful Endpoints für Strategy & Capability Map.
 * 
 * Endpoints:
 * - GET    /api/strategy/capability-map           - Vollständige Capability Map
 * - GET    /api/strategy/capability-map/gaps      - Gap-Analyse
 * - GET    /api/strategy/capability-map/investments - Investment-Empfehlungen
 * - GET    /api/strategy/capability-map/categories - Kategorien
 * 
 * @module routes/strategy.routes
 */

const express = require('express');
const router = express.Router();

const strategyController = require('../controllers/strategy.controller');

/**
 * @swagger
 * /api/strategy/capability-map:
 *   get:
 *     summary: Capability Map holen
 *     tags: [Strategy]
 *     responses:
 *       200:
 *         description: Capability Map mit Gap-Analyse
 */
router.get('/capability-map', strategyController.getCapabilityMap);

/**
 * @swagger
 * /api/strategy/capability-map/gaps:
 *   get:
 *     summary: Gap-Analyse holen
 *     tags: [Strategy]
 *     responses:
 *       200:
 *         description: Gap-Analyse mit Schweregraden
 */
router.get('/capability-map/gaps', strategyController.getGaps);

/**
 * @swagger
 * /api/strategy/capability-map/investments:
 *   get:
 *     summary: Investment-Empfehlungen holen
 *     tags: [Strategy]
 *     responses:
 *       200:
 *         description: Investment-Empfehlungen basierend auf Gaps
 */
router.get('/capability-map/investments', strategyController.getInvestmentRecommendations);

/**
 * @swagger
 * /api/strategy/capability-map/categories:
 *   get:
 *     summary: Capability-Kategorien holen
 *     tags: [Strategy]
 *     responses:
 *       200:
 *         description: Kategorien mit Counts und Capabilities
 */
router.get('/capability-map/categories', strategyController.getCapabilityCategories);

module.exports = router;
