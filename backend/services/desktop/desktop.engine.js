/**
 * KI-OS — (C) 2026 Ingo Schaffer
 * https://ki-os.org
 */
'use strict';
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs/promises');
const companion = require('./desktop.companion');
const winAdapter = require('./adapters/windows.adapter');
const macAdapter = require('./adapters/macos.adapter');

function desktopEnabled() {
  return String(process.env.DESKTOP_CONTROL_ENABLED || 'false') === 'true';
}
function allowedByRole(role) {
  return ['admin', 'owner', 'system'].includes(String(role || '').toLowerCase());
}
function getMode() {
  return String(process.env.DESKTOP_CONTROL_MODE || (process.platform === 'darwin' ? 'macos' : 'powershell')).toLowerCase();
}
function getPlatform() { return process.platform; }
function getScreenshotDir() { return companion.baseDir(); }
function userThreshold() { return Number(process.env.DESKTOP_TAKEOVER_IDLE_MS || 250); }
function minIdleMs() { return Number(process.env.DESKTOP_MIN_IDLE_MS || 900); }
function pollMs() { return Number(process.env.DESKTOP_INTERRUPT_POLL_MS || 80); }
function queueWaitMs() { return Number(process.env.DESKTOP_QUEUE_WAIT_MS || 15000); }
function queueStaleMs() { return Number(process.env.DESKTOP_QUEUE_STALE_MS || 120000); }

function isTestBypassEnabled() {
  return ['test','1','true'].includes(String(process.env.KI_OS_TEST_MODE || process.env.NODE_ENV || '').toLowerCase()) && String(process.env.DESKTOP_CONTROL_FORCE_SUPPORTED || 'false') === 'true';
}

function currentAdapterName() {
  if (isTestBypassEnabled()) return 'test-adapter';
  if (getPlatform() === 'win32' && getMode() === 'powershell') return 'windows-powershell';
  if (getPlatform() === 'darwin' && ['macos', 'swift', 'osascript'].includes(getMode())) return 'macos-swift';
  return 'unsupported';
}
function adapter() {
  if (isTestBypassEnabled()) return null;
  if (currentAdapterName() === 'windows-powershell') return winAdapter;
  if (currentAdapterName() === 'macos-swift') return macAdapter;
  return null;
}

async function readiness() {
  if (!desktopEnabled()) return { enabled: false, supported: false, ready: false, warnings: ['desktop_control_disabled'], permissions: [] };
  if (isTestBypassEnabled()) {
    return { enabled: true, supported: true, ready: true, warnings: [], permissions: [] };
  }
  const ad = adapter();
  if (!ad) {
    return {
      enabled: true,
      supported: false,
      ready: false,
      warnings: [`desktop_provider_${getMode()}_unsupported_on_${getPlatform()}`],
      permissions: getPlatform() === 'darwin' ? ['accessibility_required', 'screen_recording_required'] : []
    };
  }
  const warnings = [];
  const permissions = [];
  if (getPlatform() === 'darwin') {
    permissions.push('accessibility_required', 'screen_recording_required');
    warnings.push('macos_permissions_must_be_granted');
  }
  return { enabled: true, supported: true, ready: true, warnings, permissions };
}

async function buildStatus(extra = {}) {
  const base = await readiness();
  const st = await companion.readState();
  return {
    success: base.ready,
    enabled: base.enabled,
    supported: base.supported,
    readiness: base.ready,
    platform: getPlatform(),
    adapter: currentAdapterName(),
    hostname: os.hostname(),
    permissions: base.permissions || [],
    warnings: [...(base.warnings || []), ...(extra.warnings || [])],
    frontmostApp: extra.frontmostApp || null,
    activeWindowTitle: extra.activeWindowTitle || null,
    lastScreenshotPath: st.lastScreenshotPath,
    queueLength: Array.isArray(st.queue) ? st.queue.length + (st.active ? 1 : 0) : 0,
    queue: (st.queue || []).slice(0, 10),
    userActive: !!extra.userActive,
    interrupted: !!st.interrupted,
    interruptReason: st.interruptReason,
    lockState: { ...(st.lockState || { locked: false, sessionId: null, reason: null }) },
    stopRequested: !!st.stopRequested,
    currentAction: st.currentAction || null,
    lastActionAt: st.lastActionAt,
    lastObserveAt: st.lastObserveAt
  };
}

function normalizeAction(action) {
  return String(action || '').trim();
}

function validateAction(params = {}) {
  const action = normalizeAction(params.action);
  const n = (name) => Number.isFinite(Number(params[name]));
  const hasText = () => typeof params.text === 'string' && params.text.length > 0;
  const hasKey = () => typeof params.key === 'string' && params.key.length > 0;
  const hasKeys = () => Array.isArray(params.keys) && params.keys.length > 0;
  switch (action) {
    case 'move':
    case 'click':
    case 'doubleClick':
    case 'rightClick':
      if (!n('x') || !n('y')) return { ok: false, error: 'missing_parameter: x and y required' };
      return { ok: true, action };
    case 'drag':
      if (!n('x') || !n('y') || !n('toX') || !n('toY')) return { ok: false, error: 'missing_parameter: x,y,toX,toY required' };
      return { ok: true, action };
    case 'scroll':
      if (!Number.isFinite(Number(params.delta || 0))) return { ok: false, error: 'invalid_parameter: delta must be numeric' };
      return { ok: true, action };
    case 'type':
      if (!hasText()) return { ok: false, error: 'missing_parameter: text required' };
      return { ok: true, action };
    case 'key':
      if (!hasKey()) return { ok: false, error: 'missing_parameter: key required' };
      return { ok: true, action };
    case 'hotkey':
      if (!hasKeys()) return { ok: false, error: 'missing_parameter: keys required' };
      return { ok: true, action };
    case 'wait':
      return { ok: true, action };
    default:
      return { ok: false, error: `unsupported_action: ${action || 'unknown'}` };
  }
}

function enforceGuard(params = {}, ctx = {}) {
  const requested = params.userGuard !== false;
  const role = ctx?.pki?.role || ctx?.role || 'guest';
  if (!requested && !allowedByRole(role)) return { userGuard: true, enforced: true, reason: 'user_guard_enforced_by_role' };
  return { userGuard: requested, enforced: false, reason: null };
}

async function adapterStatus() {
  if (isTestBypassEnabled()) {
    return { success: true, platform: getPlatform(), adapter: currentAdapterName(), userActive: false, idleMs: 1000, frontmostApp: 'TestApp', activeWindowTitle: 'TestWindow' };
  }
  const ad = adapter();
  if (!ad) return { success: false, error: 'adapter_unavailable' };
  return ad.status({ userActiveThresholdMs: userThreshold() });
}

async function ensureScreenshotDir() { await fs.mkdir(getScreenshotDir(), { recursive: true }); }

async function waitForTurn(actionRef, timeoutMs = queueWaitMs()) {
  const start = Date.now();
  while (true) {
    const st = await companion.readState();
    const head = (st.queue || [])[0];
    if (head && head.id === actionRef.id) return true;
    if (Date.now() - start > timeoutMs) return false;
    // purge stale head if needed
    if (head && head.queuedAt && (Date.now() - head.queuedAt > queueStaleMs())) {
      await companion.updateState((s) => { s.queue = (s.queue || []).filter((item) => item.id !== head.id); return s; });
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}

async function checkInterrupt(guardEnabled) {
  const st = await companion.readState();
  if (st.stopRequested) return { interrupted: true, reason: 'emergency_stop_requested' };
  if (!guardEnabled) return { interrupted: false };
  const live = await adapterStatus();
  if (live.success && live.userActive) return { interrupted: true, reason: 'user_takeover_detected', live };
  return { interrupted: false, live };
}

async function runPrimitive(params) {
  if (isTestBypassEnabled()) {
    return { success: true, platform: getPlatform(), adapter: currentAdapterName(), action: params.action };
  }
  const ad = adapter();
  return ad.action(params);
}

async function runCompositeAction(params, guardEnabled) {
  const action = params.action;
  if (action === 'wait') {
    const until = Date.now() + Math.max(0, Number(params.durationMs || 0));
    while (Date.now() < until) {
      const interrupt = await checkInterrupt(guardEnabled);
      if (interrupt.interrupted) return { success: false, error: interrupt.reason, interruptReason: interrupt.reason };
      await new Promise((resolve) => setTimeout(resolve, Math.min(pollMs(), until - Date.now())));
    }
    return { success: true, action };
  }
  if (action === 'type') {
    for (const ch of String(params.text || '')) {
      const interrupt = await checkInterrupt(guardEnabled);
      if (interrupt.interrupted) return { success: false, error: interrupt.reason, interruptReason: interrupt.reason };
      const res = await runPrimitive({ action: 'type', text: ch });
      if (!res.success) return res;
    }
    return { success: true, action };
  }
  if (action === 'hotkey') {
    const interrupt = await checkInterrupt(guardEnabled);
    if (interrupt.interrupted) return { success: false, error: interrupt.reason, interruptReason: interrupt.reason };
    return runPrimitive(params);
  }
  if (action === 'drag') {
    const steps = Math.max(3, Number(params.steps || 12));
    let res = await runPrimitive({ action: 'move', x: params.x, y: params.y });
    if (!res.success) return res;
    for (let i = 1; i <= steps; i += 1) {
      const interrupt = await checkInterrupt(guardEnabled);
      if (interrupt.interrupted) return { success: false, error: interrupt.reason, interruptReason: interrupt.reason };
      const x = Number(params.x) + ((Number(params.toX) - Number(params.x)) * i / steps);
      const y = Number(params.y) + ((Number(params.toY) - Number(params.y)) * i / steps);
      res = await runPrimitive({ action: 'drag', x: Number(params.x), y: Number(params.y), toX: x, toY: y, steps: 1 });
      if (!res.success) return res;
    }
    return { success: true, action };
  }
  return runPrimitive(params);
}

async function getDesktopStatus() {
  const base = await readiness();
  if (!base.enabled || !base.supported) return buildStatus();
  const live = await adapterStatus().catch((e) => ({ success: false, warnings: [e.message] }));
  const warn = live?.success ? [] : (live?.error ? [live.error] : (live?.warnings || []));
  return buildStatus({ ...live, warnings: warn });
}

async function captureScreenshot(options = {}) {
  const r = await readiness();
  if (!r.enabled) return { ...(await buildStatus()), success: false, error: 'desktop_control_disabled' };
  if (!r.supported) return { ...(await buildStatus()), success: false, error: r.warnings[0] || 'desktop_control_unsupported' };
  await ensureScreenshotDir();
  const ext = getPlatform() === 'win32' || getPlatform() === 'darwin' ? 'png' : 'txt';
  const filename = options.filename || `screenshot-${Date.now()}.${ext}`;
  const target = path.join(getScreenshotDir(), filename);
  if (isTestBypassEnabled()) {
    await fs.writeFile(target, 'test screenshot', 'utf8');
    await companion.setScreenshot(target);
    return { success: true, path: target, adapter: currentAdapterName(), platform: getPlatform() };
  }
  const ad = adapter();
  const result = await ad.screenshot(target);
  if (result.success) await companion.setScreenshot(target);
  return result.success ? { success: true, path: target, adapter: currentAdapterName(), platform: getPlatform() } : { ...(await buildStatus()), success: false, error: result.error || 'screenshot_failed' };
}

async function observeDesktop(options = {}) {
  const status = await getDesktopStatus();
  const screenshot = options.withScreenshot === false ? null : await captureScreenshot(options);
  await companion.updateState((s) => { s.lastObserveAt = new Date().toISOString(); return s; });
  return { success: status.supported || status.enabled === false, status, screenshot, observedAt: new Date().toISOString() };
}

async function performDesktopAction(params = {}, ctx = {}) {
  const validation = validateAction(params);
  if (!validation.ok) return { ...(await buildStatus()), success: false, error: validation.error };
  const r = await readiness();
  if (!r.enabled) return { ...(await buildStatus()), success: false, error: 'desktop_control_disabled' };
  if (!r.supported) return { ...(await buildStatus()), success: false, error: r.warnings[0] || 'desktop_control_unsupported' };

  const st = await companion.readState();
  if (st.lockState?.locked && params.sessionId && st.lockState.sessionId && st.lockState.sessionId !== params.sessionId) {
    return { ...(await buildStatus()), success: false, error: 'desktop_session_locked', ownerSessionId: st.lockState.sessionId };
  }
  if (st.stopRequested) {
    await companion.setInterrupt('emergency_stop_requested');
    return { ...(await buildStatus()), success: false, error: 'desktop_stop_requested', interruptReason: 'emergency_stop_requested' };
  }

  const guard = enforceGuard(params, ctx);
  const actionRef = { id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, action: validation.action, sessionId: params.sessionId || null };
  await companion.enqueue(actionRef);
  const myTurn = await waitForTurn(actionRef);
  if (!myTurn) return { ...(await buildStatus()), success: false, error: 'desktop_queue_timeout' };
  await companion.startAction(actionRef);

  let actionSucceeded = false;
  try {
    if (guard.userGuard) {
      const pre = await adapterStatus();
      if ((isTestBypassEnabled() && params.simulateUserActive === true) || (pre.success && Number(pre.idleMs || 0) < minIdleMs())) {
        await companion.setInterrupt('user_active_before_action');
        return { ...(await buildStatus({ ...pre, userActive: true })), success: false, error: 'user_active_before_action', userGuard: true, guardEnforced: guard.enforced };
      }
    }

    const result = await runCompositeAction({ ...params, action: validation.action }, guard.userGuard);
    if (!result.success) {
      await companion.setInterrupt(result.interruptReason || result.error || 'desktop_action_failed');
      return { ...(await buildStatus()), success: false, error: result.error || 'desktop_action_failed', interruptReason: result.interruptReason || null, userGuard: guard.userGuard, guardEnforced: guard.enforced };
    }

    if (guard.userGuard) {
      const post = await adapterStatus();
      if ((isTestBypassEnabled() && params.simulateTakeover === true) || (post.success && post.userActive)) {
        await companion.setInterrupt('user_takeover_detected');
        return { ...(await buildStatus({ ...post, userActive: true })), success: false, error: 'user_takeover_detected', interruptReason: 'user_takeover_detected', userGuard: true, guardEnforced: guard.enforced };
      }
    }

    await companion.setInterrupt(null);
    actionSucceeded = true;
    return {
      ...(await buildStatus()),
      success: true,
      action: validation.action,
      userGuard: guard.userGuard,
      guardEnforced: guard.enforced,
      performed: {
        x: params.x, y: params.y, toX: params.toX, toY: params.toY,
        text: params.text, key: params.key, keys: params.keys, button: params.button
      }
    };
  } finally {
    await companion.finishAction({ action: validation.action, success: actionSucceeded });
  }
}

async function stopDesktopActions(reason = 'manual_stop') {
  await companion.requestStop(reason);
  return { ...(await buildStatus()), success: true, stopped: true };
}
async function clearStopFlag() {
  await companion.clearStop();
  return { ...(await buildStatus()), success: true, stopped: false };
}
async function lockDesktopSession({ sessionId, reason } = {}) {
  if (!sessionId) return { ...(await buildStatus()), success: false, error: 'missing_parameter: sessionId required' };
  await companion.setLock({ locked: true, sessionId, reason: reason || null });
  return { ...(await buildStatus()), success: true };
}
async function unlockDesktopSession({ sessionId } = {}) {
  const st = await companion.readState();
  if (st.lockState?.locked && sessionId && st.lockState.sessionId && st.lockState.sessionId !== sessionId) {
    return { ...(await buildStatus()), success: false, error: 'desktop_session_locked_by_other_session', ownerSessionId: st.lockState.sessionId };
  }
  await companion.setLock({ locked: false, sessionId: null, reason: null });
  return { ...(await buildStatus()), success: true };
}
async function getCompanionState() { return companion.readState(); }

function __resetDesktopState() { return companion.resetSync(); }

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
