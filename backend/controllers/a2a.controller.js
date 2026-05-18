/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
/**
 * KI-OS A2A Controller
 * 
 * HTTP-Handler für A2A API-Endpoints.
 * 
 * @module controllers/a2a.controller
 * @license AGPL-3.0
 */

'use strict';

const a2aService = require('../services/a2a/a2a.service');

/**
 * POST /api/a2a/agents
 * 
 * Agent registrieren
 */
async function registerAgent(req, res) {
  try {
    const agentInfo = req.body;
    
    if (!agentInfo.name) {
      return res.status(400).json({
        success: false,
        error: 'Agent name is required',
      });
    }
    
    const agent = await a2aService.registerAgent(agentInfo);
    
    res.status(201).json({
      success: true,
      agent,
    });
  } catch (error) {
    console.error('[A2AController.registerAgent] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message,
    });
  }
}

/**
 * DELETE /api/a2a/agents/:id
 * 
 * Agent abmelden
 */
async function unregisterAgent(req, res) {
  try {
    const { id } = req.params;
    
    const removed = await a2aService.unregisterAgent(id);
    
    if (!removed) {
      return res.status(404).json({
        success: false,
        error: 'Agent not found',
      });
    }
    
    res.json({
      success: true,
      message: 'Agent unregistered',
    });
  } catch (error) {
    console.error('[A2AController.unregisterAgent] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message,
    });
  }
}

/**
 * GET /api/a2a/agents
 * 
 * Alle Agents holen
 */
async function getAllAgents(req, res) {
  try {
    const agents = a2aService.getAllAgents();
    
    res.json({
      success: true,
      agents,
      stats: a2aService.getStats().registry,
    });
  } catch (error) {
    console.error('[A2AController.getAllAgents] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message,
    });
  }
}

/**
 * GET /api/a2a/agents/:id
 * 
 * Agent-Details holen
 */
async function getAgent(req, res) {
  try {
    const { id } = req.params;
    const agent = a2aService.getAgentsByCapability(id) || 
                  a2aService.getAgentsByType(id) ||
                  a2aService.getAllAgents().find(a => a.id === id);
    
    if (!agent) {
      return res.status(404).json({
        success: false,
        error: 'Agent not found',
      });
    }
    
    res.json({
      success: true,
      agent,
    });
  } catch (error) {
    console.error('[A2AController.getAgent] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message,
    });
  }
}

/**
 * GET /api/a2a/agents/capabilities/:capability
 * 
 * Agents mit Capability holen
 */
async function getAgentsByCapability(req, res) {
  try {
    const { capability } = req.params;
    const agents = a2aService.getAgentsByCapability(capability);
    
    res.json({
      success: true,
      agents,
      count: agents.length,
    });
  } catch (error) {
    console.error('[A2AController.getAgentsByCapability] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message,
    });
  }
}

/**
 * POST /api/a2a/agents/:id/heartbeat
 * 
 * Heartbeat senden
 */
async function heartbeat(req, res) {
  try {
    const { id } = req.params;
    const success = await a2aService.sendHeartbeat(id);
    
    if (!success) {
      return res.status(404).json({
        success: false,
        error: 'Agent not found',
      });
    }
    
    res.json({
      success: true,
    });
  } catch (error) {
    console.error('[A2AController.heartbeat] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message,
    });
  }
}

/**
 * PATCH /api/a2a/agents/:id/status
 * 
 * Agent-Status aktualisieren
 */
async function updateAgentStatus(req, res) {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    if (!['active', 'busy', 'offline'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status',
      });
    }
    
    const success = await a2aService.updateAgentStatus(id, status);
    
    res.json({
      success: true,
      status,
    });
  } catch (error) {
    console.error('[A2AController.updateAgentStatus] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message,
    });
  }
}

/**
 * POST /api/a2a/send
 * 
 * Nachricht senden
 */
async function sendMessage(req, res) {
  try {
    const message = req.body;
    
    if (!message.from) {
      return res.status(400).json({
        success: false,
        error: 'Sender (from) is required',
      });
    }
    
    if (!message.to && !message.broadcast) {
      return res.status(400).json({
        success: false,
        error: 'Recipient (to) or broadcast flag is required',
      });
    }
    
    const result = await a2aService.sendMessage(message);
    
    res.status(201).json({
      success: true,
      message: result,
    });
  } catch (error) {
    console.error('[A2AController.sendMessage] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message,
    });
  }
}

/**
 * POST /api/a2a/broadcast
 * 
 * Broadcast an alle Agents
 */
async function broadcast(req, res) {
  try {
    const message = req.body;
    
    if (!message.from) {
      return res.status(400).json({
        success: false,
        error: 'Sender (from) is required',
      });
    }
    
    const count = await a2aService.broadcast(message);
    
    res.json({
      success: true,
      sentTo: count,
    });
  } catch (error) {
    console.error('[A2AController.broadcast] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message,
    });
  }
}

/**
 * GET /api/a2a/messages/:agentId
 * 
 * Nachrichten für Agent holen
 */
async function getMessages(req, res) {
  try {
    const { agentId } = req.params;
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    
    const messages = await a2aService.getMessages(agentId, limit);
    
    res.json({
      success: true,
      messages,
      count: messages.length,
    });
  } catch (error) {
    console.error('[A2AController.getMessages] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message,
    });
  }
}

/**
 * DELETE /api/a2a/messages/:id
 * 
 * Nachricht als gelesen markieren
 */
async function acknowledgeMessage(req, res) {
  try {
    const { id } = req.params;
    
    await a2aService.acknowledgeMessage(id);
    
    res.json({
      success: true,
    });
  } catch (error) {
    console.error('[A2AController.acknowledgeMessage] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message,
    });
  }
}

/**
 * POST /api/a2a/messages/:id/complete
 * 
 * Nachricht als abgeschlossen markieren
 */
async function completeMessage(req, res) {
  try {
    const { id } = req.params;
    const { result } = req.body;
    
    await a2aService.completeMessage(id, result);
    
    res.json({
      success: true,
    });
  } catch (error) {
    console.error('[A2AController.completeMessage] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message,
    });
  }
}

/**
 * GET /api/a2a/stats
 * 
 * A2A-Stats holen
 */
async function getStats(req, res) {
  try {
    const stats = a2aService.getStats();
    
    res.json({
      success: true,
      stats,
    });
  } catch (error) {
    console.error('[A2AController.getStats] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message,
    });
  }
}

// HTTP adapter — translates custom handleHttp format to Express-style controllers
async function handleA2aRequest(path, method, body, query) {
  if (path === '/.well-known/agent.json' && method === 'GET') {
    return { statusCode: 200, body: { name: 'KI-OS Agent', version: '1.0', capabilities: ['chat', 'memory', 'agentmesh'] } };
  }

  const paramMap = {};
  const fakeReq = { params: paramMap, query: query || {}, body: body || {} };
  let respStatus = 200;
  let respBody = null;
  const fakeRes = {
    status(code) { respStatus = code; return this; },
    json(data)   { respBody = data; },
  };

  async function call(fn, params = {}) {
    Object.assign(paramMap, params);
    try { await fn(fakeReq, fakeRes); } catch (e) { respStatus = 500; respBody = { success: false, error: e.message }; }
    return { statusCode: respStatus, body: respBody };
  }

  if (path === '/a2a/stats'   && method === 'GET')  return call(getStats);
  if (path === '/a2a/agents'  && method === 'GET')  return call(getAllAgents);
  if (path === '/a2a/agents'  && method === 'POST') return call(registerAgent);
  if (path === '/a2a/send'    && method === 'POST') return call(sendMessage);
  if (path === '/a2a/broadcast' && method === 'POST') return call(broadcast);

  let m;
  if ((m = path.match(/^\/a2a\/agents\/capabilities\/([^/]+)$/)) && method === 'GET')  return call(getAgentsByCapability, { capability: m[1] });
  if ((m = path.match(/^\/a2a\/agents\/([^/]+)\/heartbeat$/))    && method === 'POST') return call(heartbeat, { id: m[1] });
  if ((m = path.match(/^\/a2a\/agents\/([^/]+)\/status$/))       && method === 'PATCH') return call(updateAgentStatus, { id: m[1] });
  if ((m = path.match(/^\/a2a\/agents\/([^/]+)$/))) {
    if (method === 'GET')    return call(getAgent, { id: m[1] });
    if (method === 'DELETE') return call(unregisterAgent, { id: m[1] });
  }
  if ((m = path.match(/^\/a2a\/messages\/([^/]+)\/complete$/)) && method === 'POST')   return call(completeMessage, { id: m[1] });
  if ((m = path.match(/^\/a2a\/messages\/([^/]+)$/))) {
    if (method === 'GET')    return call(getMessages, { agentId: m[1] });
    if (method === 'DELETE') return call(acknowledgeMessage, { id: m[1] });
  }

  return { statusCode: 404, body: { error: 'Not Found', path, method } };
}

module.exports = {
  registerAgent,
  unregisterAgent,
  getAllAgents,
  getAgent,
  getAgentsByCapability,
  heartbeat,
  updateAgentStatus,
  sendMessage,
  broadcast,
  getMessages,
  acknowledgeMessage,
  completeMessage,
  getStats,
  handleA2aRequest
};
