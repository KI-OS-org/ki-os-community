/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
// (c) 2026 KI-OS.org by Ingo Schaffer und Kimba — AGPL-3.0-only
// @desc Skill Router — findet passendes Skill per Keyword-Matching auf query
'use strict';

function findSkill(registry, query) {
  const q = query.toLowerCase().trim();
  const byName = registry.find(q);
  if (byName) return byName;
  for (const skill of registry.skills) {
    for (const trigger of skill.triggers) {
      if (q.includes(trigger.toLowerCase())) return skill;
    }
  }
  return null;
}

module.exports = { findSkill };
