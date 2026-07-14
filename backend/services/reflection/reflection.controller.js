/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
/**
 * KI-OS Reflection Controller
 * 
 * HTTP-Handler für Reflection API.
 * 
 * @module services/reflection/reflection.controller.js
 * @license AGPL-3.0
 */

'use strict';

const { reflect, REFLECTION_MIN_SCORE } = require('./reflection.service');
const { retrieve: memoryRetrieve } = require('../memory/swarm.memory');

/**
 * POST /api/reflection/evaluate
 * 
 * Agent-Run bewerten und Learning generieren.
 */
async function evaluateRun(req, res) {
  try {
    const { runId, task, output, toolsUsed, actualCostUSD, budgetCapUSD, latencyMs, reviewerScore, taskType, agents } = req.body;

    if (!runId || !task) {
      return res.status(400).json({
        success: false,
        error: 'runId and task are required',
      });
    }

    const runData = {
      runId,
      task,
      output: output || '',
      toolsUsed: toolsUsed || [],
      actualCostUSD: actualCostUSD || 0,
      budgetCapUSD: budgetCapUSD || 10,
      latencyMs: latencyMs || 0,
      reviewerScore: reviewerScore || 0,
      taskType: taskType || 'generic',
      agents: agents || [],
    };

    const result = await reflect(runData);

    res.json({
      success: true,
      result,
    });
  } catch (error) {
    console.error('[ReflectionController.evaluateRun] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}

/**
 * GET /api/reflection/learnings
 * 
 * Learnings aus Swarm Memory holen.
 */
async function getLearnings(req, res) {
  try {
    const { query, limit = 10 } = req.query;

    if (!query) {
      return res.status(400).json({
        success: false,
        error: 'query parameter is required',
      });
    }

    const learnings = await memoryRetrieve(query, Number(limit), { type: 'reflection' });

    res.json({
      success: true,
      learnings,
      count: learnings.length,
    });
  } catch (error) {
    console.error('[ReflectionController.getLearnings] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}

/**
 * GET /api/reflection/stats
 * 
 * Reflection-Statistiken.
 */
async function getStats(req, res) {
  try {
    // Placeholder für zukünftige Stats
    res.json({
      success: true,
      stats: {
        totalReflections: 0,
        avgScore: 0,
        minScore: REFLECTION_MIN_SCORE,
      },
    });
  } catch (error) {
    console.error('[ReflectionController.getStats] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}

module.exports = {
  evaluateRun,
  getLearnings,
  getStats,
};

async function handleReflectionRequest(path, method, body, query) {
  const fakeReq = { body, query };
  const fakeRes = {
    status: function (statusCode) {
      this.statusCode = statusCode;
      return this;
    },
    json: function (responseBody) {
      this.body = responseBody;
      return this;
    },
  };

  switch (path) {
    case '/reflection/evaluate':
      if (method === 'POST') {
        await evaluateRun(fakeReq, fakeRes);
      } else {
        fakeRes.status(405).json({ success: false, error: 'Method not allowed' });
      }
      break;
    case '/reflection/learnings':
      if (method === 'GET') {
        await getLearnings(fakeReq, fakeRes);
      } else {
        fakeRes.status(405).json({ success: false, error: 'Method not allowed' });
      }
      break;
    case '/reflection/stats':
      if (method === 'GET') {
        await getStats(fakeReq, fakeRes);
      } else {
        fakeRes.status(405).json({ success: false, error: 'Method not allowed' });
      }
      break;
    default:
      fakeRes.status(404).json({ success: false, error: 'Not found' });
  }

  return { statusCode: fakeRes.statusCode, body: fakeRes.body };
}

module.exports = {
  evaluateRun,
  getLearnings,
  getStats,
  handleReflectionRequest,
};
