/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
// FILE: backend/services/skills/skill.installer.js
// (c) 2026 KI-OS.org by Ingo Schaffer und Kimba — AGPL-3.0-only
// @desc Skill Installer — installiert externe Skills via npm oder git
'use strict';

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { readManifest, writeManifest, addEntry, removeEntry } = require('./skill.manifest');

const SKILLS_EXTERNAL_DIR = process.env.SKILLS_EXTERNAL_DIR || path.join(__dirname, '../../../skills/external');
const SKILL_GIT_DOMAINS = process.env.SKILL_GIT_DOMAINS || 'github.com,gitlab.com';

function validateSkill(skillPath) {
  const skill = require(skillPath);
  if (!skill.name || !skill.description || !Array.isArray(skill.triggers) || typeof skill.execute !== 'function') {
    throw new Error('Invalid skill structure');
  }
}

function installSkill(source, opts = {}) {
  const allowlist = opts.allowlist || [];
  const externalDir = opts.externalDir || SKILLS_EXTERNAL_DIR;
  const manifestPath = opts.manifestPath || path.join(externalDir, 'installed.json');
  const isNpm = source.startsWith('npm:');
  const isGit = source.startsWith('git:');
  let skillName;

  if (isNpm) {
    const packageName = source.slice(4);
    if (!packageName.startsWith('@ki-os/skill-') && !allowlist.includes(packageName)) {
      throw new Error('Package not allowed');
    }
    execSync(`npm install --prefix ${externalDir} ${packageName}`, { stdio: 'pipe' });
    skillName = packageName.includes('/') ? packageName.split('/')[1] : packageName;
  } else if (isGit) {
    const url = source.slice(4);
    const domain = new URL(url).hostname;
    if (!SKILL_GIT_DOMAINS.split(',').includes(domain)) {
      throw new Error('Git domain not allowed');
    }
    const targetDir = path.join(externalDir, path.basename(url, '.git'));
    execSync(`git clone ${url} ${targetDir}`, { stdio: 'pipe' });
    validateSkill(path.join(targetDir, 'index.js'));
    skillName = path.basename(url, '.git');
  } else {
    throw new Error('Invalid source type');
  }

  const installedAt = new Date().toISOString();
  addEntry(manifestPath, { name: skillName, source, installedAt });

  return { name: skillName, source, installedAt };
}

function uninstallSkill(name, skillsExternalDir = SKILLS_EXTERNAL_DIR) {
  const manifestPath = path.join(skillsExternalDir, 'installed.json');
  const entries = readManifest(manifestPath);
  const entry = entries.find(e => e.name === name);

  if (!entry) {
    throw new Error('Skill not found');
  }

  const skillPath = path.join(skillsExternalDir, name);
  fs.rmSync(skillPath, { recursive: true, force: true });
  removeEntry(manifestPath, name);

  return { removed: name };
}

function listInstalled(skillsExternalDir = SKILLS_EXTERNAL_DIR) {
  const manifestPath = path.join(skillsExternalDir, 'installed.json');
  return readManifest(manifestPath);
}

module.exports = { installSkill, uninstallSkill, listInstalled };
