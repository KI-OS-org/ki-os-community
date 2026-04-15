/**
 * KI-OS — (C) 2026 Ingo Schaffer
 * https://ki-os.org
 */
'use strict';
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');

function baseDir() {
  return path.resolve(process.cwd(), process.env.DESKTOP_SCREENSHOT_DIR || 'runtime/local/.desktop');
}
function statePath() {
  return path.join(baseDir(), 'desktop-companion-state.json');
}

const defaultState = () => ({
  version: 1,
  active: false,
  stopRequested: false,
  interrupted: false,
  interruptReason: null,
  lastActionAt: null,
  lastObserveAt: null,
  lastScreenshotPath: null,
  lockState: { locked: false, sessionId: null, reason: null },
  queue: [],
  history: [],
  currentAction: null
});

async function ensureDir() {
  await fsp.mkdir(baseDir(), { recursive: true });
}

async function readState() {
  await ensureDir();
  try {
    const raw = await fsp.readFile(statePath(), 'utf8');
    return { ...defaultState(), ...JSON.parse(raw || '{}') };
  } catch {
    const state = defaultState();
    await writeState(state);
    return state;
  }
}

async function writeState(state) {
  await ensureDir();
  const target = statePath();
  const tmp = `${target}.tmp`;
  await fsp.writeFile(tmp, JSON.stringify(state, null, 2), 'utf8');
  await fsp.rename(tmp, target);
  return state;
}

async function updateState(mutator) {
  const current = await readState();
  const next = await Promise.resolve(mutator({ ...current, queue: [...(current.queue || [])], history: [...(current.history || [])] })) || current;
  return writeState(next);
}

async function enqueue(action) {
  return updateState((s) => {
    s.queue.push({ ...action, queuedAt: Date.now() });
    return s;
  });
}

async function startAction(action) {
  return updateState((s) => {
    s.active = true;
    s.currentAction = { ...action, startedAt: Date.now() };
    s.lastActionAt = new Date().toISOString();
    return s;
  });
}

async function finishAction(result = {}) {
  return updateState((s) => {
    s.active = false;
    s.currentAction = null;
    if (s.queue.length) s.queue.shift();
    s.history.unshift({ ...result, finishedAt: Date.now() });
    s.history = s.history.slice(0, 50);
    return s;
  });
}

async function requestStop(reason = 'manual_stop') {
  return updateState((s) => {
    s.stopRequested = true;
    s.interrupted = true;
    s.interruptReason = reason;
    return s;
  });
}

async function clearStop() {
  return updateState((s) => {
    s.stopRequested = false;
    s.interrupted = false;
    s.interruptReason = null;
    return s;
  });
}

async function setInterrupt(reason) {
  return updateState((s) => {
    s.interrupted = !!reason;
    s.interruptReason = reason || null;
    return s;
  });
}

async function setScreenshot(filePath) {
  return updateState((s) => {
    s.lastScreenshotPath = filePath || null;
    s.lastObserveAt = new Date().toISOString();
    return s;
  });
}

async function setLock(lockState) {
  return updateState((s) => {
    s.lockState = { locked: !!lockState?.locked, sessionId: lockState?.sessionId || null, reason: lockState?.reason || null };
    return s;
  });
}

async function reset() {
  return writeState(defaultState());
}


function resetSync() {
  fs.mkdirSync(baseDir(), { recursive: true });
  fs.writeFileSync(statePath(), JSON.stringify(defaultState(), null, 2), 'utf8');
  return defaultState();
}

module.exports = {
  baseDir,
  statePath,
  ensureDir,
  readState,
  writeState,
  updateState,
  enqueue,
  startAction,
  finishAction,
  requestStop,
  clearStop,
  setInterrupt,
  setScreenshot,
  setLock,
  reset,
  resetSync
};
