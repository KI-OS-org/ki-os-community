/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
// (c) 2026 KI-OS.org by Ingo Schaffer und Kimba — AGPL-3.0-only

const SHADOW_STAFF = {
  researcher:  { displayName: 'KIMBA Research',    model: process.env.SHADOW_RESEARCHER_MODEL  || 'qwen/qwen3-235b-a22b',         emoji: '🔬' },
  reviewer:    { displayName: 'KIMBA Critic',       model: process.env.SHADOW_REVIEWER_MODEL    || 'deepseek/deepseek-r1',          emoji: '🎯' },
  executor:    { displayName: 'KIMBA Developer',    model: process.env.SHADOW_EXECUTOR_MODEL    || 'qwen/qwen3-coder',              emoji: '⚙️' },
  planner:     { displayName: 'KIMBA Strategist',   model: process.env.SHADOW_PLANNER_MODEL     || 'mistralai/codestral-2501',      emoji: '🗺️' },
  supervisor:  { displayName: 'KIMBA Controller',   model: process.env.SHADOW_SUPERVISOR_MODEL  || 'claude-sonnet-4-6',             emoji: '🎖️' },
  synthesizer: { displayName: 'KIMBA Synthesizer',  model: process.env.SHADOW_SYNTHESIZER_MODEL || 'mistralai/codestral-2501',      emoji: '✨' },
  policy:      { displayName: 'KIMBA Legal',        model: process.env.SHADOW_POLICY_MODEL      || 'deepseek/deepseek-r1',          emoji: '⚖️' },
  memory:      { displayName: 'KIMBA Memory',       model: process.env.SHADOW_MEMORY_MODEL      || 'claude-haiku-4-5-20251001',     emoji: '🧠' },
};

/**
 * Returns the display name for a given role.
 * @param {string} role
 * @returns {string}
 */
function getDisplayName(role) {
  const staff = SHADOW_STAFF[role];
  return staff ? staff.displayName : role;
}

/**
 * Returns the emoji for a given role.
 * @param {string} role
 * @returns {string}
 */
function getEmoji(role) {
  const staff = SHADOW_STAFF[role];
  return staff ? staff.emoji : '🤖';
}

/**
 * Returns the combined display label (Emoji + Name).
 * @param {string} role
 * @returns {string}
 */
function getDisplayLabel(role) {
  const emoji = getEmoji(role);
  const name = getDisplayName(role);
  return `${emoji} ${name}`;
}

/**
 * Returns all configured staff roles and their metadata.
 * @returns {Object}
 */
function getAllStaff() {
  return SHADOW_STAFF;
}

/**
 * Resolves the underlying model string for a role.
 * @param {string} role
 * @returns {string|undefined}
 */
function resolveModel(role) {
  const staff = SHADOW_STAFF[role];
  return staff ? staff.model : undefined;
}

module.exports = {
  SHADOW_STAFF,
  getDisplayName,
  getEmoji,
  getDisplayLabel,
  getAllStaff,
  resolveModel,
};