/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
/**
 * KI-OS Hierarchical API Controller
 *
 * @license AGPL-3.0-only
 */
'use strict';

const hierarchical = require('./hierarchical.service');

async function runHierarchical(req, res) {
  try {
    const result = await hierarchical.runHierarchical(req.body || {}, {
      userId: req.headers['x-user-id'] || req.body?.userId,
      tenantId: req.headers['x-tenant-id'] || req.body?.tenantId
    });
    res.status(202).json({ success: true, result });
  } catch (error) {
    const status = /task is required/i.test(error.message) ? 400 : 500;
    res.status(status).json({ success: false, error: error.message });
  }
}

async function getTeams(req, res) {
  try {
    res.json({ success: true, ...hierarchical.getTeams() });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

async function getStats(req, res) {
  try {
    res.json({ success: true, stats: hierarchical.getStats() });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

module.exports = { runHierarchical, getTeams, getStats };
