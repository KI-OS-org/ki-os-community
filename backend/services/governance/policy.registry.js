/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
/**
 * KI-OS — (C) 2026 Ingo Schaffer
 * https://ki-os.org
 * @license AGPL-3.0-only
 */
"use strict";
const fs = require('fs');
const path = require('path');
const { policyConfigPath, getPolicyDefinitions } = require('./policy.engine');

function configDir() { return path.dirname(policyConfigPath()); }

function listPolicyVersions() {
  const dir = configDir();
  let files = [];
  try { files = fs.readdirSync(dir).filter((name) => /^governance\.policies(\.[\w-]+)?\.json$/i.test(name)); } catch {}
  const current = path.basename(policyConfigPath());
  const items = files.map((name) => ({ name, path: path.join(dir, name), current: name === current }));
  if (!items.some((item) => item.current)) items.unshift({ name: current, path: policyConfigPath(), current: true });
  return items;
}

function getPolicyRegistryPayload() {
  const currentPath = policyConfigPath();
  return { success: true, current: path.basename(currentPath), currentPath, versions: listPolicyVersions(), activePolicies: getPolicyDefinitions() };
}

module.exports = { listPolicyVersions, getPolicyRegistryPayload };
