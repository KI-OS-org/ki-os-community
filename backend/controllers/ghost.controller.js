/**
 * Ghost Control — Controller
 *
 * HTTP-Handler für Ghost Control API.
 *
 * @module controllers/ghost.controller.js
 */

const GhostPlannerService = require('../services/ghost/ghost-planner.service');
const GhostExecutorService = require('../services/ghost/ghost-executor.service');

const plannerService = new GhostPlannerService();
const executorService = new GhostExecutorService();

/**
 * POST /api/ghost/plan
 *
 * Generiert GhostPlan basierend auf User-Input.
 */
async function generatePlan(req, res) {
  try {
    // body kann direkt im req.body oder in req.body.body sein (wegen core/app.js wrapping)
    const requestBody = req.body.body || req.body;
    const { goal, mode } = requestBody;

    if (!goal) {
      return { statusCode: 400, body: { success: false, error: 'Goal is required' } };
    }

    const plan = await plannerService.generatePlan(goal, mode || 'demo');

    return { statusCode: 200, body: { success: true, plan } };
  } catch (error) {
    console.error('[GhostController.generatePlan] Error:', error);
    return { statusCode: 500, body: { success: false, error: error.message } };
  }
}

/**
 * POST /api/ghost/execute
 *
 * Führt GhostPlan oder einzelnen Step aus.
 */
async function execute(req, res) {
  try {
    // body kann direkt im req.body oder in req.body.body sein (wegen core/app.js wrapping)
    const requestBody = req.body.body || req.body;
    const { plan, stepId, context = {} } = requestBody;

    if (!plan && !stepId) {
      return { statusCode: 400, body: { success: false, error: 'Plan or stepId is required' } };
    }

    let result;

    if (plan) {
      // Ganzen Plan ausführen
      result = await executorService.executePlan(plan, context);
    } else {
      // Einzelnen Step ausführen (wird vom Frontend aufgerufen)
      const step = plan.steps.find(s => s.id === stepId);
      if (!step) {
        return { statusCode: 404, body: { success: false, error: 'Step not found' } };
      }
      result = await executorService.executeStep(step, context);
    }

    return { statusCode: 200, body: { success: true, result } };
  } catch (error) {
    console.error('[GhostController.execute] Error:', error);
    return { statusCode: 500, body: { success: false, error: error.message } };
  }
}

/**
 * GET /api/ghost/session/:sessionId
 *
 * Holt Session-Status.
 */
async function getSession(req, res) {
  try {
    const { sessionId } = req.params;

    const fs = require('fs').promises;
    const path = require('path');
    const sessionFile = path.join(process.cwd(), '.ki-os-ghost-sessions.json');

    let sessions = {};
    try {
      const data = await fs.readFile(sessionFile, 'utf-8');
      sessions = JSON.parse(data);
    } catch (e) {
      return { statusCode: 404, body: { success: false, error: 'Session not found' } };
    }

    const session = sessions[sessionId];

    if (!session) {
      return { statusCode: 404, body: { success: false, error: 'Session not found' } };
    }

    return { statusCode: 200, body: { success: true, session } };
  } catch (error) {
    console.error('[GhostController.getSession] Error:', error);
    return { statusCode: 500, body: { success: false, error: error.message } };
  }
}

/**
 * POST /api/ghost/session/:sessionId/confirm
 *
 * User-Confirmation für Step.
 */
async function confirmStep(req, res) {
  try {
    const { sessionId } = req.params;
    const { stepId, confirmed } = req.body;

    // Session updaten
    const fs = require('fs').promises;
    const path = require('path');
    const sessionFile = path.join(process.cwd(), '.ki-os-ghost-sessions.json');

    let sessions = {};
    try {
      const data = await fs.readFile(sessionFile, 'utf-8');
      sessions = JSON.parse(data);
    } catch (e) {
      return { statusCode: 404, body: { success: false, error: 'Session not found' } };
    }

    if (sessions[sessionId]) {
      sessions[sessionId].lastConfirmation = {
        stepId,
        confirmed,
        timestamp: new Date().toISOString(),
      };

      await fs.writeFile(sessionFile, JSON.stringify(sessions, null, 2), 'utf-8');
    }

    return { statusCode: 200, body: { success: true, message: confirmed ? 'Step confirmed' : 'Step rejected' } };
  } catch (error) {
    console.error('[GhostController.confirmStep] Error:', error);
    return { statusCode: 500, body: { success: false, error: error.message } };
  }
}

/**
 * GET /api/ghost/history
 *
 * Holt Ghost Session History.
 */
async function getHistory(req, res) {
  try {
    const fs = require('fs').promises;
    const path = require('path');
    const sessionFile = path.join(process.cwd(), '.ki-os-ghost-sessions.json');

    let sessions = {};
    try {
      const data = await fs.readFile(sessionFile, 'utf-8');
      sessions = JSON.parse(data);
    } catch (e) {
      return { statusCode: 200, body: { success: true, sessions: [] } };
    }

    // In Array umwandeln und sortieren
    const sessionArray = Object.entries(sessions)
      .map(([id, session]) => ({ id, ...session }))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 50); // Letzte 50 Sessions

    return { statusCode: 200, body: { success: true, sessions: sessionArray } };
  } catch (error) {
    console.error('[GhostController.getHistory] Error:', error);
    return { statusCode: 500, body: { success: false, error: error.message } };
  }
}

module.exports = {
  generatePlan,
  execute,
  getSession,
  confirmStep,
  getHistory,
};
