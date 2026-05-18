/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
/**
 * @file    ghost.plan.controller.js
 * @desc    Express Request Handler für Ghost Control Endpoints.
 *          POST /ghost/plan — Generiert einen GhostPlan aus einem User-Ziel.
 * @author  Ingo Schaffer <ingo@ki-os.org>
 * @coauthor Kimba <kimba@ki-os.org>
 * @license AGPL-3.0-only — https://www.gnu.org/licenses/agpl-3.0.html
 * (c) 2026 KI-OS.org by Ingo Schaffer und Kimba
 */

'use strict';

const { generatePlan, replanOnVisionFail, MAX_REPLAN_ATTEMPTS } = require('./ghost.plan.service');
const { verifyStep } = require('./ghost.vision.service');
const logger = require('../core/logger.service');

/**
 * POST /ghost/plan
 * Body: { goal: string, mode?: 'demo' | 'build' }
 */
async function handleGhostPlan(path, method, body, ctx) {
  if (method !== 'POST') {
    return { statusCode: 405, body: { success: false, error: 'Method Not Allowed' } };
  }

  const goal = String((body && body.goal) || '').trim();
  if (!goal) {
    return { statusCode: 400, body: { success: false, error: 'goal is required' } };
  }
  if (goal.length > 500) {
    return { statusCode: 400, body: { success: false, error: 'goal must be ≤ 500 characters' } };
  }

  const rawMode = body && body.mode;
  if (rawMode && rawMode !== 'demo' && rawMode !== 'build') {
    return { statusCode: 400, body: { success: false, error: `Invalid mode "${rawMode}". Must be "demo" or "build"` } };
  }
  const mode = rawMode === 'build' ? 'build' : 'demo';

  try {
    const result = await generatePlan(goal, mode, {
      ...ctx,
      route: '/ghost/plan',
      path: '/ghost/plan',
    });
    return { statusCode: 200, body: result };
  } catch (err) {
    logger.error('ghost.plan.controller.error', { error: err.message });
    return {
      statusCode: 500,
      body: { success: false, error: 'Ghost Plan generation failed', details: err.message }
    };
  }
}

/**
 * POST /ghost/verify
 * Body: { imageData: string, stepDescription: string, stepType?: string, target?: string }
 */
async function handleGhostVerify(path, method, body, ctx) {
  if (method !== 'POST') {
    return { statusCode: 405, body: { success: false, error: 'Method Not Allowed' } };
  }

  const imageData       = String((body && body.imageData)       || '').trim();
  const stepDescription = String((body && body.stepDescription) || '').trim();

  if (!imageData) {
    return { statusCode: 400, body: { success: false, error: 'imageData is required (base64 or data-URL)' } };
  }
  if (!stepDescription) {
    return { statusCode: 400, body: { success: false, error: 'stepDescription is required' } };
  }

  const options = {
    stepType: body.stepType ? String(body.stepType) : undefined,
    target:   body.target   ? String(body.target)   : undefined,
  };

  try {
    const result = await verifyStep(imageData, stepDescription, options);
    return { statusCode: 200, body: { success: true, ...result } };
  } catch (err) {
    logger.error('ghost.verify.controller.error', { error: err.message });
    if (/imageData|Base64|Bild|Bildtyp|base64|too large|groß|unsupported|invalid/i.test(err.message)) {
      return {
        statusCode: 400,
        body: { success: false, error: 'Invalid imageData', details: err.message }
      };
    }
    return {
      statusCode: 500,
      body: { success: false, error: 'Ghost Vision verification failed', details: err.message }
    };
  }
}

/**
 * POST /ghost/replan
 * Body: {
 *   goal: string, mode?: string,
 *   originalPlan: object, failedStepIndex: number,
 *   visionResult: { verified: false, description?: string, hint?: string },
 *   retryCount?: number
 * }
 */
async function handleGhostReplan(path, method, body, ctx) {
  if (method !== 'POST') {
    return { statusCode: 405, body: { success: false, error: 'Method Not Allowed' } };
  }

  const goal            = String((body && body.goal) || '').trim();
  const originalPlan    = body && body.originalPlan;
  const failedStepIndex = Number(body && body.failedStepIndex);
  const visionResult    = body && body.visionResult;

  if (!goal) {
    return { statusCode: 400, body: { success: false, error: 'goal ist erforderlich' } };
  }
  if (!originalPlan || !Array.isArray(originalPlan.steps)) {
    return { statusCode: 400, body: { success: false, error: 'originalPlan.steps ist erforderlich' } };
  }
  if (!Number.isInteger(failedStepIndex) || failedStepIndex < 0) {
    return { statusCode: 400, body: { success: false, error: 'failedStepIndex muss eine ganze Zahl ≥ 0 sein' } };
  }
  if (!visionResult || visionResult.verified !== false) {
    return { statusCode: 400, body: { success: false, error: 'visionResult.verified muss false sein' } };
  }

  const retryCount = Number.isInteger(body.retryCount) && body.retryCount >= 0 ? body.retryCount : 0;
  const mode       = body.mode === 'build' ? 'build' : 'demo';

  try {
    const result = await replanOnVisionFail({
      goal,
      mode,
      originalPlan,
      failedStepIndex,
      visionResult,
      retryCount,
      ctx: { ...ctx, route: '/ghost/replan', path: '/ghost/replan' },
    });
    return { statusCode: 200, body: result };
  } catch (err) {
    logger.error('ghost.replan.controller.error', { error: err.message });
    return {
      statusCode: 500,
      body: { success: false, error: 'Ghost Re-Plan generation failed', details: err.message }
    };
  }
}

/**
 * Route dispatcher für alle /ghost/* Pfade.
 */
async function handleGhostRequest(path, method, body, ctx) {
  if (path === '/ghost/plan') {
    return handleGhostPlan(path, method, body, ctx);
  }
  if (path === '/ghost/verify') {
    return handleGhostVerify(path, method, body, ctx);
  }
  if (path === '/ghost/replan') {
    return handleGhostReplan(path, method, body, ctx);
  }
  return { statusCode: 404, body: { success: false, error: `Ghost route not found: ${path}` } };
}

module.exports = { handleGhostRequest };
