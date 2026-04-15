/**
 * KI-OS — (C) 2026 Ingo Schaffer
 * https://ki-os.org
 */
"use strict";
const engine = require('./desktop.engine');
const client = require('./desktop.daemon.client');

function useDaemon() {
  return client.daemonEnabled() && String(process.env.DESKTOP_CONTROL_ENABLED || 'false') === 'true';
}

async function viaDaemon(method, path, body) {
  return client.call(method, path, body || {});
}

async function getDesktopStatus() {
  return useDaemon() ? viaDaemon('GET', '/status') : engine.getDesktopStatus();
}
async function captureScreenshot(options = {}) {
  return useDaemon() ? viaDaemon('POST', '/screenshot', options) : engine.captureScreenshot(options);
}
async function observeDesktop(options = {}) {
  return useDaemon() ? viaDaemon('POST', '/observe', options) : engine.observeDesktop(options);
}
async function performDesktopAction(params = {}, ctx = {}) {
  return useDaemon() ? viaDaemon('POST', '/action', { params, ctx }) : engine.performDesktopAction(params, ctx);
}
async function stopDesktopActions(reason = 'manual_stop') {
  return useDaemon() ? viaDaemon('POST', '/stop', { reason }) : engine.stopDesktopActions(reason);
}
async function clearStopFlag() {
  return useDaemon() ? viaDaemon('POST', '/clear-stop', {}) : engine.clearStopFlag();
}
async function lockDesktopSession(payload = {}) {
  return useDaemon() ? viaDaemon('POST', '/lock', payload) : engine.lockDesktopSession(payload);
}
async function unlockDesktopSession(payload = {}) {
  return useDaemon() ? viaDaemon('POST', '/unlock', payload) : engine.unlockDesktopSession(payload);
}
async function getCompanionState() {
  return useDaemon() ? viaDaemon('GET', '/state') : engine.getCompanionState();
}
function enforceGuard(params = {}, ctx = {}) { return engine.enforceGuard(params, ctx); }
function validateAction(params = {}) { return engine.validateAction(params); }
function __resetDesktopState() {
  process.env.DESKTOP_DAEMON_ENABLED = 'false';
  return engine.__resetDesktopState();
}

module.exports = {
  getDesktopStatus,
  captureScreenshot,
  observeDesktop,
  performDesktopAction,
  stopDesktopActions,
  clearStopFlag,
  lockDesktopSession,
  unlockDesktopSession,
  getCompanionState,
  enforceGuard,
  validateAction,
  __resetDesktopState
};
