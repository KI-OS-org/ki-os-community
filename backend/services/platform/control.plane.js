/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
// (c) 2026 KI-OS.org by Ingo Schaffer und Kimba — AGPL-3.0-only
// @desc Control Plane (S8) — aggregiert echte Verfügbarkeits-Daten aus node-registry/claws/CLI-Checks, erfindet keine eigene Verfügbarkeits-Logik

const { spawnSync } = require('node:child_process');
const nodeRegistry = require('../sync/node-registry.service.js');
const clawInstaller = require('../claws/claw.installer.js');
const clawSandbox = require('../claws/claw.sandbox.js');

const BACKEND_TYPES = {
  LOCAL_NODE: 'local-node',
  CLOUD: 'cloud',
  CLI_TOOL: 'cli-tool',
  CLAW: 'claw'
};

function listBackends() {
  const backends = [];

  // 1. Lokale Nodes
  const nodeStatus = nodeRegistry.getStatus();
  for (const [id, node] of Object.entries(nodeStatus.nodes)) {
    backends.push({
      id,
      type: BACKEND_TYPES.LOCAL_NODE,
      available: node.status === 'online',
      meta: {
        model: node.model,
        role: node.role,
        lastSeen: node.lastSeen,
        latencyMs: node.latencyMs
      }
    });
  }

  // 2. Cloud-Provider
  const cloudProviders = [
    { id: 'anthropic', envVar: 'ANTHROPIC_API_KEY' },
    { id: 'openrouter', envVar: 'OPENROUTER_API_KEY' },
    { id: 'gemini', envVar: 'GEMINI_API_KEY' }
  ];
  
  for (const provider of cloudProviders) {
    const configured = !!process.env[provider.envVar];
    backends.push({
      id: provider.id,
      type: BACKEND_TYPES.CLOUD,
      available: configured,
      meta: { configured }
    });
  }

  // 3. CLI-Tools
  const cliTools = [
    { id: 'claude-code', tool: 'claude' },
    { id: 'codex', tool: 'codex' }
  ];

  for (const tool of cliTools) {
    let available = false;
    try {
      const result = spawnSync(tool.tool, ['--version'], { timeout: 3000, stdio: 'ignore' });
      available = result.status === 0;
    } catch (err) {
      // ENOENT oder anderer Fehler → nicht verfügbar
      available = false;
    }
    
    backends.push({
      id: tool.id,
      type: BACKEND_TYPES.CLI_TOOL,
      available,
      meta: {}
    });
  }

  // 4. Installierte Claws
  const installedClaws = clawInstaller.listInstalled();
  for (const claw of installedClaws) {
    const available = claw.ampel !== 'red' && clawSandbox.isDockerAvailable();
    backends.push({
      id: `claw:${claw.name}`,
      type: BACKEND_TYPES.CLAW,
      available,
      meta: {
        ampel: claw.ampel,
        permissionRisk: claw.permissionRisk,
        permissions: claw.permissions,
        version: claw.version
      }
    });
  }

  return backends;
}

function getBackendStatus(id) {
  const backends = listBackends();
  return backends.find(b => b.id === id);
}

module.exports = {
  listBackends,
  getBackendStatus,
  BACKEND_TYPES
};
