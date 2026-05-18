/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
/**
 * (c) 2026 KI-OS.org by Ingo Schaffer und Kimba
 * @license AGPL-3.0-only
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { writeAudit } = require('../../ui/ui.audit');

const TOOL_NAME = 'write_file';
const ALLOWED_PREFIXES = ['backend/', 'mobile/src/', 'scripts/', 'docs/'];
const ALLOWED_MODES = new Set(['overwrite', 'append', 'create-only']);

function normalizeRelativePath(inputPath) {
  const normalized = String(inputPath || '').replace(/\\/g, '/').trim();
  if (!normalized) throw new Error('write_file requires a non-empty path');
  if (path.isAbsolute(normalized)) throw new Error('write_file path must be relative to the KI-OS root');
  if (normalized.includes('..')) throw new Error('write_file path traversal is not allowed');
  if (!ALLOWED_PREFIXES.some((prefix) => normalized.startsWith(prefix))) {
    throw new Error(`write_file path must start with one of: ${ALLOWED_PREFIXES.join(', ')}`);
  }
  return normalized;
}

function resolveMode(mode) {
  const resolved = String(mode || 'overwrite').trim().toLowerCase();
  if (!ALLOWED_MODES.has(resolved)) throw new Error('write_file mode must be overwrite, append, or create-only');
  return resolved;
}

async function execute({ path: targetPath, content, mode = 'overwrite' } = {}, ctx = {}) {
  const relativePath = normalizeRelativePath(targetPath);
  const writeMode = resolveMode(mode);
  const payload = String(content == null ? '' : content);
  const absolutePath = path.join(process.cwd(), relativePath);

  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });

  if (writeMode === 'create-only') {
    if (fs.existsSync(absolutePath)) throw new Error(`write_file target already exists: ${relativePath}`);
    fs.writeFileSync(absolutePath, payload, { encoding: 'utf8', flag: 'wx' });
  } else if (writeMode === 'append') {
    fs.appendFileSync(absolutePath, payload, 'utf8');
  } else {
    fs.writeFileSync(absolutePath, payload, 'utf8');
  }

  const bytesWritten = Buffer.byteLength(payload, 'utf8');
  writeAudit('agentmesh.write_file', {
    type: 'agentmesh',
    tool: TOOL_NAME,
    path: relativePath,
    mode: writeMode,
    bytesWritten
  }, ctx);

  return { success: true, path: relativePath, bytesWritten };
}

module.exports = { TOOL_NAME, execute };
