/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
/**
 * (c) 2026 KI-OS.org by Ingo Schaffer und Kimba
 * Datei: openapi-bridge.service.js
 * Registriert OpenAPI-Specs als dynamische MCP-Tools — jede REST-API wird KIMBA-Tool.
 * @license AGPL-3.0-only
 */
'use strict';

const path = require('path');
let axios; try { axios = require('axios'); } catch {}

const _cache = new Map();
const DB_PATH = process.env.OPENAPI_BRIDGE_DB || path.join(__dirname, '../../../.kios/openapi-bridge.db');
let _db = null;

function _getDb() {
  if (_db) return _db;
  try {
    const Database = require('better-sqlite3');
    _db = new Database(DB_PATH);
    _db.exec(`CREATE TABLE IF NOT EXISTS openapi_specs (
      id TEXT PRIMARY KEY, name TEXT, url TEXT,
      toolCount INTEGER, registeredAt INTEGER, spec TEXT
    )`);
    return _db;
  } catch { return null; }
}

function _extractTools(spec) {
  const tools = [];
  let baseUrl = '';
  if (spec.servers?.[0]?.url) baseUrl = spec.servers[0].url;
  else if (spec.host) baseUrl = `https://${spec.host}${spec.basePath || ''}`;
  baseUrl = baseUrl.replace(/\/$/, '');

  for (const [p, pathItem] of Object.entries(spec.paths || {})) {
    for (const method of ['get', 'post', 'put', 'patch', 'delete']) {
      const op = pathItem?.[method];
      if (!op) continue;
      const name = op.operationId || `${method}_${p.replace(/[^a-zA-Z0-9]/g, '_')}`;
      const description = op.summary || op.description || `${method.toUpperCase()} ${p}`;
      const inputSchema = { type: 'object', properties: {}, required: [] };
      for (const param of (op.parameters || [])) {
        if (param.in === 'path' || param.in === 'query') {
          inputSchema.properties[param.name] = param.schema || { type: param.type || 'string' };
          if (param.required) inputSchema.required.push(param.name);
        }
      }
      const jsonSchema = op.requestBody?.content?.['application/json']?.schema;
      if (jsonSchema) {
        Object.assign(inputSchema.properties, jsonSchema.properties || {});
        if (jsonSchema.required) inputSchema.required.push(...jsonSchema.required);
      }
      tools.push({ name, description, method: method.toUpperCase(), path: p, baseUrl, inputSchema });
    }
  }
  return tools;
}

async function registerSpec(id, specOrUrl) {
  let spec;
  if (typeof specOrUrl === 'string') {
    if (!axios) throw new Error('axios not available');
    spec = (await axios.get(specOrUrl)).data;
  } else {
    spec = specOrUrl;
  }
  const tools = _extractTools(spec);
  const db = _getDb();
  if (db) {
    db.prepare(`INSERT OR REPLACE INTO openapi_specs (id,name,url,toolCount,registeredAt,spec)
      VALUES (?,?,?,?,?,?)`).run(
      id, spec.info?.title || id,
      typeof specOrUrl === 'string' ? specOrUrl : null,
      tools.length, Date.now(), JSON.stringify(spec)
    );
  }
  const toolsWithId = tools.map(t => ({ ...t, specId: id }));
  _cache.set(id, { spec, tools: toolsWithId });
  return { id, toolCount: tools.length, tools: tools.map(t => t.name) };
}

function listTools() {
  const all = [];
  for (const [, entry] of _cache) all.push(...entry.tools);
  return all;
}

async function executeTool(toolName, params = {}) {
  if (!axios) throw new Error('axios not available');
  let tool = null;
  for (const entry of _cache.values()) {
    tool = entry.tools.find(t => t.name === toolName);
    if (tool) break;
  }
  if (!tool) throw new Error(`Tool not found: ${toolName}`);

  let url = tool.baseUrl + tool.path;
  const used = new Set();
  for (const match of (tool.path.match(/\{(\w+)\}/g) || [])) {
    const key = match.slice(1, -1);
    if (params[key] !== undefined) { url = url.replace(match, encodeURIComponent(params[key])); used.add(key); }
  }
  const rest = Object.fromEntries(Object.entries(params).filter(([k]) => !used.has(k)));
  const isBodyMethod = ['POST', 'PUT', 'PATCH'].includes(tool.method);
  const response = await axios({ method: tool.method.toLowerCase(), url,
    ...(isBodyMethod ? { data: rest } : { params: rest })
  });
  return { status: response.status, data: response.data };
}

function removeSpec(specId) {
  _cache.delete(specId);
  const db = _getDb();
  if (db) db.prepare('DELETE FROM openapi_specs WHERE id=?').run(specId);
  return { removed: true, toolCount: 0 };
}

function listSpecs() {
  const db = _getDb();
  if (!db) return [];
  return db.prepare('SELECT id,name,url,toolCount,registeredAt FROM openapi_specs').all();
}

module.exports = { registerSpec, listTools, executeTool, removeSpec, listSpecs };
