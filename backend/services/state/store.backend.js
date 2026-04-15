/**
 * KI-OS — (C) 2026 Ingo Schaffer
 * https://ki-os.org
 */
"use strict";
const fs = require('fs');
const path = require('path');

function ensureDirFor(filePath) { fs.mkdirSync(path.dirname(filePath), { recursive: true }); }
function safeParse(raw, fallback) { try { return JSON.parse(raw); } catch { return fallback; } }
function nowIso() { return new Date().toISOString(); }

function backendMode(envKey, defaultMode = 'file') {
  return String(process.env[envKey] || process.env.STATE_BACKEND || defaultMode).trim().toLowerCase() || defaultMode;
}

function resolveFilePath(filePath, fallbackName) {
  return filePath || path.join(process.cwd(), fallbackName);
}

function getDynamoEmulationFile() {
  return process.env.KI_OS_DYNAMODB_EMULATION_FILE || path.join(process.cwd(), '.ki-os-dynamodb-emulation.json');
}

function readEmulatedDynamoState() {
  const file = getDynamoEmulationFile();
  try { return safeParse(fs.readFileSync(file, 'utf8'), { tables: {} }); } catch { return { tables: {} }; }
}

function writeEmulatedDynamoState(state) {
  const file = getDynamoEmulationFile();
  ensureDirFor(file);
  fs.writeFileSync(file, JSON.stringify(state, null, 2), 'utf8');
}

function createStoreBackend(options = {}) {
  const mode = backendMode(options.backendEnvKey || '', options.defaultMode || 'file');
  const filePath = resolveFilePath(process.env[options.filePathEnvKey || ''], options.defaultFileName || '.ki-os-store.json');
  const tableName = String(process.env[options.tableEnvKey || ''] || options.defaultTableName || options.name || 'ki_os_store').trim();
  const pk = String(options.partitionKey || 'pk');

  function read() {
    if (mode === 'dynamodb') {
      const state = readEmulatedDynamoState();
      const table = state.tables[tableName] || {};
      const item = table[pk] || { value: options.defaultValueFactory ? options.defaultValueFactory() : {} };
      return item.value;
    }
    try { return safeParse(fs.readFileSync(filePath, 'utf8'), options.defaultValueFactory ? options.defaultValueFactory() : {}); }
    catch { return options.defaultValueFactory ? options.defaultValueFactory() : {}; }
  }

  function write(value) {
    if (mode === 'dynamodb') {
      const state = readEmulatedDynamoState();
      state.tables[tableName] = state.tables[tableName] || {};
      state.tables[tableName][pk] = { pk, value, updatedAt: nowIso(), backend: 'dynamodb-emulated' };
      writeEmulatedDynamoState(state);
      return value;
    }
    ensureDirFor(filePath);
    const tmp = `${filePath}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(value, null, 2), 'utf8');
    fs.renameSync(tmp, filePath);
    return value;
  }

  function remove() {
    if (mode === 'dynamodb') {
      const state = readEmulatedDynamoState();
      if (state.tables[tableName]) delete state.tables[tableName][pk];
      writeEmulatedDynamoState(state);
      return true;
    }
    try { fs.rmSync(filePath, { force: true }); } catch {}
    return true;
  }

  function info() {
    return {
      kind: mode === 'dynamodb' ? 'dynamodb' : 'file',
      mode,
      path: mode === 'file' ? filePath : null,
      tableName: mode === 'dynamodb' ? tableName : null,
      emulated: mode === 'dynamodb',
      emulationFile: mode === 'dynamodb' ? getDynamoEmulationFile() : null,
      backendEnvKey: options.backendEnvKey || null,
      tableEnvKey: options.tableEnvKey || null,
      filePathEnvKey: options.filePathEnvKey || null
    };
  }

  return { read, write, remove, info };
}

module.exports = { createStoreBackend, backendMode, getDynamoEmulationFile };