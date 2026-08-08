/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
/**
 * (c) 2026 KI-OS.org (v1.6.0) by Ingo Schaffer und Kimba
 * Datei: tool.registry.v2.js
 * Diese Datei enthält JavaScript-Logik für Runtime, Services, Tools oder Tests innerhalb des KI-OS AgentMesh.
 * @license AGPL-3.0-only
 */


'use strict';
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const { createToolDefinitions } = require('./browser');

function safeResolve(baseDir, target) {
  const resolved = path.resolve(baseDir, target || '.');
  if (!resolved.startsWith(path.resolve(baseDir))) throw new Error('Path escapes sandbox');
  return resolved;
}

class ToolRegistryV2 {
  constructor(options = {}) {
    this.baseDir = options.baseDir || process.cwd();
    this.allowShell = String(process.env.LOCAL_TOOLS_ALLOW_SHELL || 'false') === 'true';
    this.tools = {
      filesystem_read: {
        name: 'filesystem_read',
        description: 'Read a text file from the local sandbox',
        execute: async ({ file }) => {
          const full = safeResolve(this.baseDir, file);
          return { file, content: fs.readFileSync(full, 'utf8') };
        }
      },
      filesystem_write: {
        name: 'filesystem_write',
        description: 'Write a text file into the local sandbox',
        execute: async ({ file, content }) => {
          const full = safeResolve(this.baseDir, file);
          fs.mkdirSync(path.dirname(full), { recursive: true });
          fs.writeFileSync(full, String(content || ''), 'utf8');
          return { success: true, file };
        }
      },
      filesystem_list: {
        name: 'filesystem_list',
        description: 'List files in a local sandbox folder',
        execute: async ({ dir = '.' }) => {
          const full = safeResolve(this.baseDir, dir);
          return { dir, items: fs.readdirSync(full).sort() };
        }
      },
      shell_exec: {
        name: 'shell_exec',
        description: 'Execute a local shell command when explicitly enabled',
        execute: async ({ command, timeout = 5000 }) => {
          if (!this.allowShell) throw new Error('Shell tool disabled');
          const out = cp.execSync(String(command), { cwd: this.baseDir, stdio: ['ignore', 'pipe', 'pipe'], timeout: Number(timeout) });
          return { stdout: out.toString('utf8') };
        }
      }
    };
    this.browserTool = options.browserTool;
    Object.assign(this.tools, createToolDefinitions(this.browserTool));
  }
  list() { return Object.values(this.tools).map(({ name, description }) => ({ name, description })); }
  get(name) { return this.tools[name]; }
}

module.exports = { ToolRegistryV2 };
