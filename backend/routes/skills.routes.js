/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
// (c) 2026 KI-OS.org by Ingo Schaffer und Kimba — AGPL-3.0-only
// @desc Skills API — GET /api/skills, POST /api/skills/invoke
'use strict';
const express  = require('express');
const path     = require('path');
const router   = express.Router();
const { SkillRegistry } = require('../services/skills/skill.registry');
const { findSkill }     = require('../services/skills/skill.router');
const { execute }       = require('../services/skills/skill.executor');

const SKILLS_DIR = path.join(__dirname, '../../skills');
const registry   = new SkillRegistry(SKILLS_DIR);

router.get('/', (req, res) => {
  res.json({ skills: registry.list(), count: registry.count() });
});

router.post('/invoke', async (req, res) => {
  const { name, query, args } = req.body || {};
  let skill = null;
  if (name)  skill = registry.find(name);
  else if (query) skill = findSkill(registry, query);

  if (!skill) return res.status(404).json({ error: 'Skill nicht gefunden', query, name });

  const result = await execute(skill, args || {});
  res.json(result);
});

// Admin-Routen: install/uninstall/catalog/installed (vJ4)
router.use('/', require('./skills-admin.routes'));

module.exports = router;
