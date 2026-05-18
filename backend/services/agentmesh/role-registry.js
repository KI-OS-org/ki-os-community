/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
// (c) 2026 KI-OS.org by Ingo Schaffer und Kimba — AGPL-3.0-only
'use strict';

// Eingebaute Standard-Capabilities
const BUILTIN_ROLES = {
  supervisor:  { capabilities: ['orchestrate', 'monitor', 'escalate'], cost: 'high', model: process.env.MESH_MODEL_FULL || 'claude-haiku-4-5-20251001' },
  policy:      { capabilities: ['governance', 'compliance', 'risk'], cost: 'medium', model: process.env.MESH_MODEL_CHEAP || 'claude-haiku-4-5-20251001' },
  planner:     { capabilities: ['plan', 'decompose', 'sequence'], cost: 'medium', model: process.env.MESH_MODEL_FULL },
  researcher:  { capabilities: ['search', 'analyse', 'summarise'], cost: 'medium', model: process.env.MESH_RESEARCHER_MODEL || 'qwen/qwen-2.5-72b-instruct' },
  memory:      { capabilities: ['remember', 'retrieve', 'store'], cost: 'low', model: process.env.MESH_MODEL_CHEAP },
  executor:    { capabilities: ['execute', 'implement', 'run'], cost: 'medium', model: process.env.MESH_MODEL_FULL },
  reviewer:    { capabilities: ['review', 'critique', 'verify'], cost: 'medium', model: process.env.MESH_REVIEWER_MODEL || 'deepseek/deepseek-chat' },
  synthesizer: { capabilities: ['synthesize', 'summarise', 'report'], cost: 'medium', model: process.env.MESH_MODEL_FULL },
};

const _registry = new Map(Object.entries(BUILTIN_ROLES));

function registerRole(name, config = {}) {
  if (!name) return null;
  const roleConfig = {
    capabilities: Array.isArray(config.capabilities) ? config.capabilities : [],
    cost: config.cost || 'medium',
    model: config.model || ''
  };
  _registry.set(name, roleConfig);
  return roleConfig;
}

function getRole(name) {
  return _registry.get(name) || null;
}

function getRolesForTask(taskDescription) {
  const task = String(taskDescription || '').toLowerCase();
  let matched;

  if (task.includes('code') || task.includes('implement') || task.includes('build')) {
    matched = ['planner', 'executor', 'reviewer'];
  } else if (task.includes('research') || task.includes('analyse') || task.includes('search')) {
    matched = ['researcher', 'synthesizer'];
  } else if (task.includes('review') || task.includes('audit') || task.includes('check')) {
    matched = ['reviewer', 'synthesizer'];
  } else if (task.includes('plan') || task.includes('design') || task.includes('architect')) {
    matched = ['planner', 'synthesizer'];
  } else {
    matched = ['planner', 'executor', 'reviewer', 'synthesizer'];
  }

  return ['supervisor', 'policy', 'memory', ...matched];
}

function listRoles() {
  return Array.from(_registry.keys());
}

function getModel(roleName) {
  const role = getRole(roleName);
  return role ? role.model : null;
}

module.exports = { registerRole, getRole, getRolesForTask, listRoles, getModel, BUILTIN_ROLES };
