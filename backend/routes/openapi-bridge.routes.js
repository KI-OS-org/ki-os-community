/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
/**
 * (c) 2026 KI-OS.org by Ingo Schaffer und Kimba
 * Datei: openapi-bridge.routes.js
 * HTTP-Routen für OpenAPI-to-MCP Bridge — REST-APIs als KIMBA-Tools registrieren.
 * @license AGPL-3.0-only
 */

'use strict';

const express = require('express');
const bridge = require('../services/mcp/openapi-bridge.service');
const router = express.Router();

router.post('/register', async (req, res) => {
  try {
    const { id, spec } = req.body;
    
    if (!id || !spec) {
      return res.status(400).json({ 
        error: 'Bad Request: id and spec are required' 
      });
    }
    
    const result = await bridge.registerSpec(id, spec);
    res.status(200).json({ ok: true, ...result });
  } catch (error) {
    res.status(500).json({ 
      error: error.message || 'Internal server error during registration' 
    });
  }
});

router.get('/tools', async (req, res) => {
  try {
    const tools = await bridge.listTools();
    res.status(200).json({ 
      tools, 
      count: tools.length 
    });
  } catch (error) {
    res.status(500).json({ 
      error: error.message || 'Failed to list tools' 
    });
  }
});

router.post('/execute', async (req, res) => {
  try {
    const { tool, params } = req.body;
    
    if (!tool) {
      return res.status(400).json({ 
        error: 'Bad Request: tool is required' 
      });
    }
    
    const result = await bridge.executeTool(tool, params || {});
    res.status(200).json(result);
  } catch (error) {
    if (error.message && error.message.toLowerCase().includes('not found')) {
      return res.status(404).json({ 
        error: error.message 
      });
    }
    res.status(500).json({ 
      error: error.message || 'Tool execution failed' 
    });
  }
});

router.delete('/spec/:id', async (req, res) => {
  try {
    const result = await bridge.removeSpec(req.params.id);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ 
      error: error.message || 'Failed to remove specification' 
    });
  }
});

router.get('/specs', async (req, res) => {
  try {
    const specs = await bridge.listSpecs();
    res.status(200).json({ 
      specs, 
      count: specs.length 
    });
  } catch (error) {
    res.status(500).json({ 
      error: error.message || 'Failed to list specifications' 
    });
  }
});

module.exports = router;