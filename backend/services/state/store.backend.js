/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
'use strict';
/* KI-OS Community Edition — Autor: Ingo Schaffer — AGPL-3.0-only */
const fs   = require('fs');
const path = require('path');

function createStoreBackend(options = {}) {
  const envKey  = options.filePathEnvKey || '';
  const envVal  = envKey ? process.env[envKey] : '';
  const filePath = envVal || path.join(process.cwd(), options.defaultFileName || '.ki-os-store.json');

  function read() {
    try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); }
    catch { return options.defaultValueFactory ? options.defaultValueFactory() : {}; }
  }

  function write(value) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    const tmp = filePath + '.' + process.pid + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(value, null, 2), 'utf8');
    fs.renameSync(tmp, filePath);
    return value;
  }

  function remove() {
    try { fs.rmSync(filePath, { force: true }); } catch {}
    return true;
  }

  function info() { return { kind: 'file', path: filePath }; }

  return { read, write, remove, info };
}

module.exports = { createStoreBackend };
