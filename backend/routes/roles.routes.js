/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
// (c) 2026 KI-OS.org by Ingo Schaffer und Kimba — AGPL-3.0-only
'use strict';

const express = require('express');
const roleRegistry = require('../services/agentmesh/role-registry');

const router = express.Router();

router.get('/', (req, res) => {
  res.json({ roles: roleRegistry.listRoles() });
});

router.get('/:name', (req, res) => {
  const role = roleRegistry.getRole(req.params.name);
  if (!role) {
    return res.status(404).json({ error: 'Role not found' });
  }
  return res.json(role);
});

router.post('/recommend', (req, res) => {
  const task = req.body && req.body.task;
  return res.json({ roles: roleRegistry.getRolesForTask(task) });
});

module.exports = router;
