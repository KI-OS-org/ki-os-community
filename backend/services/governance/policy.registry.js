/**
 * KI-OS — (C) 2026 Ingo Schaffer
 * https://ki-os.org
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
