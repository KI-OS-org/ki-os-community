/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
// (c) 2026 KI-OS.org by Ingo Schaffer und Kimba — AGPL-3.0-only
// @desc Skill Registry — lädt alle *.skill.js aus skills/-Verzeichnis, indiziert nach Name + Trigger
'use strict';
const fs   = require('fs');
const path = require('path');

function loadSkills(skillsDir) {
  if (!fs.existsSync(skillsDir)) return [];
  const files = fs.readdirSync(skillsDir).filter(f => f.endsWith('.skill.js'));
  const skills = [];
  for (const file of files) {
    try {
      const m = require(path.join(skillsDir, file));
      if (typeof m.name === 'string' && typeof m.description === 'string' &&
          Array.isArray(m.triggers) && typeof m.execute === 'function') {
        skills.push(m);
      } else {
        console.warn(`[Skills] Ungültige Struktur: ${file} — übersprungen`);
      }
    } catch (e) {
      console.warn(`[Skills] Ladefehler ${file}:`, e.message);
    }
  }
  return skills;
}

class SkillRegistry {
  constructor(skillsDir) {
    this.skills = loadSkills(skillsDir);
    console.log(`[Skills] ${this.skills.length} Skills geladen aus ${skillsDir}`);
  }

  list() {
    return this.skills.map(({ name, description, triggers }) => ({ name, description, triggers }));
  }

  find(name) {
    const q = name.toLowerCase().trim();
    return this.skills.find(s => s.name.toLowerCase() === q) || null;
  }

  count() { return this.skills.length; }
}

module.exports = { SkillRegistry, loadSkills };
