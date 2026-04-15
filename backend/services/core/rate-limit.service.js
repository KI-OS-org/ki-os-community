/**
 * KI-OS — (C) 2026 Ingo Schaffer
 * https://ki-os.org
 */
'use strict';

const fs = require('fs');
const path = require('path');

const buckets = new Map();

function getPersistPath() {
  const raw = String(process.env.RATE_LIMIT_PERSIST_PATH || '').trim();
  return raw ? raw : null;
}

function ensureDirFor(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function persistBuckets() {
  const filePath = getPersistPath();
  if (!filePath) return;
  ensureDirFor(filePath);
  const payload = {
    version: 'v1',
    persistedAt: new Date().toISOString(),
    items: Array.from(buckets.entries()).map(([key, value]) => ({ key, ...value }))
  };
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf8');
}

function loadBuckets() {
  const filePath = getPersistPath();
  buckets.clear();
  if (!filePath) return;
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    for (const item of Array.isArray(parsed?.items) ? parsed.items : []) {
      if (item && item.key) buckets.set(item.key, { startedAt: Number(item.startedAt || Date.now()), count: Number(item.count || 0) });
    }
  } catch {}
}

function normalizePath(pathname = '') {
  const target = String(pathname || '/');
  if (target === '/ui/stream') return 'ui_stream';
  if (target.startsWith('/desktop')) return 'desktop';
  if (target.startsWith('/admin')) return 'admin';
  if (target.startsWith('/ui/')) return 'ui';
  if (target === '/chat' || target === '/v1/chat' || target === '/') return 'chat';
  return 'default';
}

function getLimitConfig(group) {
  const windowMs = Number(process.env.RATE_LIMIT_WINDOW_MS || 60_000);
  const defaults = {
    default: Number(process.env.RATE_LIMIT_DEFAULT_MAX || 300),
    chat: Number(process.env.RATE_LIMIT_CHAT_MAX || 120),
    ui: Number(process.env.RATE_LIMIT_UI_MAX || 180),
    ui_stream: Number(process.env.RATE_LIMIT_STREAM_MAX || 20),
    desktop: Number(process.env.RATE_LIMIT_DESKTOP_MAX || 60),
    admin: Number(process.env.RATE_LIMIT_ADMIN_MAX || 30)
  };
  return { windowMs, max: defaults[group] || defaults.default };
}

function getIdentity({ headers = {}, ctx = {} } = {}) {
  return String(
    ctx?.pki?.userId ||
    headers['x-user-id'] ||
    headers['x-forwarded-for'] ||
    headers['x-real-ip'] ||
    headers['cf-connecting-ip'] ||
    'anonymous'
  );
}

function assertRateLimit({ path, method, headers = {}, ctx = {} } = {}) {
  const group = normalizePath(path);
  const { windowMs, max } = getLimitConfig(group);
  const identity = getIdentity({ headers, ctx });
  const key = `${group}:${identity}:${String(method || 'GET').toUpperCase()}`;
  const currentTime = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || currentTime - bucket.startedAt >= windowMs) {
    buckets.set(key, { startedAt: currentTime, count: 1 });
    persistBuckets();
    return { remaining: Math.max(0, max - 1), windowMs, max, group };
  }

  bucket.count += 1;
  if (bucket.count > max) {
    persistBuckets();
    const error = new Error('Too Many Requests');
    error.statusCode = 429;
    error.retryAfter = Math.max(1, Math.ceil((windowMs - (currentTime - bucket.startedAt)) / 1000));
    error.rateLimit = { group, max, windowMs, identity };
    throw error;
  }
  persistBuckets();
  return { remaining: Math.max(0, max - bucket.count), windowMs, max, group };
}

function getRateLimitSnapshot() {
  loadBuckets();
  const items = Array.from(buckets.entries()).map(([key, value]) => ({ key, startedAt: value.startedAt, count: value.count }));
  return {
    backend: getRateLimitBackendInfo(),
    totalBuckets: items.length,
    items
  };
}

function importRateLimitSnapshot(payload = {}) {
  buckets.clear();
  for (const item of Array.isArray(payload?.items) ? payload.items : []) {
    if (item && item.key) buckets.set(item.key, { startedAt: Number(item.startedAt || Date.now()), count: Number(item.count || 0) });
  }
  persistBuckets();
  return getRateLimitSnapshot();
}

function getRateLimitBackendInfo() {
  return {
    kind: getPersistPath() ? 'file' : 'memory',
    path: getPersistPath(),
    windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 60_000)
  };
}

function resetRateLimits() {
  buckets.clear();
  const filePath = getPersistPath();
  if (filePath) {
    try { fs.rmSync(filePath, { force: true }); } catch {}
  }
}

loadBuckets();

module.exports = {
  assertRateLimit,
  resetRateLimits,
  getRateLimitSnapshot,
  importRateLimitSnapshot,
  getRateLimitBackendInfo
};
