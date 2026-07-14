/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
/**
 * (c) 2026 KI-OS.org by Ingo Schaffer und Kimba
 * Datei: mcp.routes.js
 * Express Routes fuer KI-OS MCP Gateway (SSE + Status).
 * @license AGPL-3.0-only
 */
'use strict';

const express = require('express');
const mcpGateway = require('../services/mcp/mcp.gateway.service');

const router = express.Router();

function requireEnabled(req, res, next) {
  if (!mcpGateway.isEnabled()) return res.status(503).json({ error: 'MCP Gateway disabled', hint: 'Set MCP_GATEWAY_ENABLED=true and install @modelcontextprotocol/sdk' });
  next();
}

router.get('/status', (req, res) => res.json(mcpGateway.getStatus()));

router.get('/sse', requireEnabled, (req, res) => mcpGateway.startSse(req, res));

router.post('/message', requireEnabled, (req, res) => mcpGateway.handleMessage(req, res));

module.exports = router;
