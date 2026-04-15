/**
 * KI-OS — (C) 2026 Ingo Schaffer
 * https://ki-os.org
 */
'use strict';
const path = require('node:path');
const fs = require('node:fs/promises');
const { access } = require('node:fs/promises');
const { constants } = require('node:fs');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const execFileAsync = promisify(execFile);
const { baseDir } = require('../desktop.companion');

function supported() {
  return process.platform === 'darwin';
}
function helperSourcePath() {
  return path.resolve(process.cwd(), 'backend/services/desktop/helpers/macos_desktop_helper.swift');
}
function helperBinPath() {
  return path.join(baseDir(), 'macos-desktop-helper');
}

async function exists(file) {
  try { await access(file, constants.X_OK); return true; } catch { return false; }
}

async function ensureHelper() {
  await fs.mkdir(baseDir(), { recursive: true });
  const bin = helperBinPath();
  if (await exists(bin)) return bin;
  const src = helperSourcePath();
  await execFileAsync('/usr/bin/xcrun', ['swiftc', '-O', src, '-o', bin], {
    timeout: Number(process.env.DESKTOP_MACOS_COMPILE_TIMEOUT_MS || 60000),
    maxBuffer: 10 * 1024 * 1024
  });
  return bin;
}

async function execPayload(payload, timeoutMs = Number(process.env.DESKTOP_TIMEOUT_MS || 15000)) {
  const bin = await ensureHelper();
  const json = JSON.stringify(payload);
  const { stdout } = await execFileAsync(bin, [json], { timeout: timeoutMs, maxBuffer: 10 * 1024 * 1024 });
  return JSON.parse(String(stdout || '{}').trim() || '{}');
}

async function status(options = {}) {
  return execPayload({ mode: 'status', userActiveThresholdMs: options.userActiveThresholdMs });
}
async function screenshot(target) {
  return execPayload({ mode: 'screenshot', target }, Number(process.env.DESKTOP_TIMEOUT_MS || 15000));
}
async function action(params) {
  return execPayload({ mode: 'action', ...params }, Number(params?.timeoutMs || process.env.DESKTOP_TIMEOUT_MS || 15000));
}

module.exports = { supported, status, screenshot, action, helperBinPath };
