/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
// (c) 2026 KI-OS.org by Ingo Schaffer und Kimba · AGPL-3.0-only
'use strict';
const express = require('express');
const { McpRegistryService } = require('../services/mcp/registry.service');
const router = express.Router();
const registry = new McpRegistryService();

router.get('/servers', async (req, res) => {
  try { res.json(await registry.getAll()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/search', async (req, res) => {
  try { res.json(await registry.search(req.query.q || '')); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/suggest', async (req, res) => {
  try { res.json(await registry.suggest(req.body.context || '')); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

async function handleMcpRegistryRequest(path, method, body, query) {
  const subPath = path.replace(/^\/mcp\/registry/, '') || '/';
  return new Promise((resolve) => {
    let statusCode = 200;
    const fakeReq = { method: method.toUpperCase(), url: subPath, path: subPath, params: {}, query: query || {}, body: body || {}, headers: {} };
    const fakeRes = {
      status(code) { statusCode = code; return this; },
      json(data) { resolve({ statusCode, body: data }); },
      send(data) { resolve({ statusCode, body: data }); },
    };
    const fakeNext = (err) => resolve({ statusCode: err ? 500 : 404, body: { error: err?.message || 'Not Found' } });
    try { router(fakeReq, fakeRes, fakeNext); }
    catch (e) { resolve({ statusCode: 500, body: { error: e.message } }); }
  });
}

module.exports = { router, handleMcpRegistryRequest };
