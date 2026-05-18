/**
 * KI-OS Community Edition — Core Infrastructure
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: Apache License 2.0
 * SPDX-License-Identifier: Apache-2.0
 */
/**
 * (c) 2026 KI-OS.org by Ingo Schaffer und Kimba
 * Datei: swarm.controller.js
 * Swarm Memory REST API — 6 Endpunkte für POST/GET/DELETE.
 * @license AGPL-3.0-only
 */

'use strict';

const swarm  = require('./swarm.memory');
const logger = require('../core/logger.service');

const MAX_TEXT = 2000;

function sanitize(val) {
  if (typeof val !== 'string') return val;
  return val
    .slice(0, MAX_TEXT)
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '');
}

async function handleSwarm(path, method, body = {}, ctx = {}) {
  try {

    // ── POST ────────────────────────────────────────────────────────────────────
    if (method === 'POST') {
      if (path === '/swarm/store') {
        const text = body?.text;
        if (typeof text !== 'string' || !text.trim())
          return { _status: 400, error: 'text ist erforderlich und darf nicht leer sein' };
        const metadata = body.metadata && typeof body.metadata === 'object' ? body.metadata : {};
        return swarm.store(sanitize(text), metadata);
      }

      if (path === '/swarm/retrieve') {
        const query = body?.query;
        if (typeof query !== 'string' || !query.trim())
          return { _status: 400, error: 'query ist erforderlich und darf nicht leer sein' };
        const k = Number.isInteger(body.k) && body.k > 0 ? body.k : 5;
        return swarm.retrieve(sanitize(query), k);
      }

      if (path === '/swarm/feedback') {
        const { id, positive } = body || {};
        if (typeof id !== 'string' || !id.trim())
          return { _status: 400, error: 'id ist erforderlich' };
        const pos = typeof positive === 'boolean' ? positive : true;
        return swarm.feedback(id.trim(), pos);
      }

      return { _status: 404, error: 'Not Found' };
    }

    // ── GET ─────────────────────────────────────────────────────────────────────
    if (method === 'GET') {
      if (path === '/swarm/stats') {
        return swarm.getStats();
      }

      if (path === '/swarm/entries') {
        // body = query string params für GET-Requests in KI-OS app.js Konvention
        const limit = parseInt(body?.limit, 10) || 50;
        const type  = typeof body?.type === 'string' ? body.type : null;
        return swarm.getEntries(Math.min(limit, 500), type);
      }

      return { _status: 404, error: 'Not Found' };
    }

    // ── DELETE ──────────────────────────────────────────────────────────────────
    if (method === 'DELETE') {
      if (path === '/swarm/prune') {
        return swarm.prune();
      }
      return { _status: 404, error: 'Not Found' };
    }

    return { _status: 405, error: 'Method Not Allowed' };

  } catch (err) {
    logger.error('[swarm.controller] Fehler', { path, method, error: err.message });
    return { _status: 500, error: 'Internal error' };
  }
}

module.exports = { handleSwarm };
