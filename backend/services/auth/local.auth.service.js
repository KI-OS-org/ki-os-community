/**
 * (c) 2026 KI-OS.org (v6.0) by Ingo Schaffer und Kimba
 * Datei: local.auth.service.js
 * Local file-based auth service for KI-OS Community Edition.
 * No AWS/cloud dependencies — stores users in .ki-os-users.json at project root.
 */

'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const logger = require('../core/logger.service');

let _usersFile = path.join(process.cwd(), '.ki-os-users.json');

const ACCESS_TOKEN_TTL = '1h';
const REFRESH_TOKEN_TTL = '7d';

const VALID_ROLES = ['admin', 'operator', 'auditor', 'user'];

// ─── Brute-force protection ───────────────────────────────────────────────────

const loginAttempts = new Map(); // email → { count, lockedUntil }
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes

// ─── JWT (same pattern as pki/auth.service.js) ───────────────────────────────

class JWT {
  static sign(payload, secret, expiresIn = '1h') {
    const header = { alg: 'HS256', typ: 'JWT' };
    const headerB64 = Buffer.from(JSON.stringify(header)).toString('base64url');
    const exp = Math.floor(Date.now() / 1000) + JWT._parseExpiry(expiresIn);
    const payloadWithExp = { ...payload, exp, iat: Math.floor(Date.now() / 1000) };
    const payloadB64 = Buffer.from(JSON.stringify(payloadWithExp)).toString('base64url');
    const signature = crypto
      .createHmac('sha256', secret)
      .update(`${headerB64}.${payloadB64}`)
      .digest('base64url');
    return `${headerB64}.${payloadB64}.${signature}`;
  }

  static verify(token, secret) {
    const parts = String(token || '').split('.');
    if (parts.length !== 3) throw new Error('Invalid token format');
    const [headerB64, payloadB64, signature] = parts;
    const expected = crypto
      .createHmac('sha256', secret)
      .update(`${headerB64}.${payloadB64}`)
      .digest('base64url');
    if (signature !== expected) throw new Error('Invalid token signature');
    let payload;
    try {
      payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString());
    } catch {
      throw new Error('Invalid token payload');
    }
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      throw new Error('Token expired');
    }
    return payload;
  }

  static _parseExpiry(expiresIn) {
    const match = String(expiresIn).match(/^(\d+)([hdm])$/);
    if (!match) return 3600;
    const multipliers = { h: 3600, d: 86400, m: 60 };
    return parseInt(match[1], 10) * multipliers[match[2]];
  }
}

// ─── Password hashing (PBKDF2 via Node crypto) ────────────────────────────────

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, storedHash) {
  if (!storedHash) return false;
  const [salt, hash] = storedHash.split(':');
  if (!salt || !hash) return false;
  const verify = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return verify === hash;
}

// ─── Random password generator ───────────────────────────────────────────────

function randomPassword(length = 12) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
  return Array.from(crypto.randomBytes(length))
    .map(b => chars[b % chars.length])
    .join('');
}

// ─── User store (file-based, with cache) ─────────────────────────────────────

let _usersCache = null;
let _usersCacheTime = 0;
const CACHE_TTL_MS = 30 * 1000; // 30 seconds

function loadUsers() {
  const now = Date.now();
  if (_usersCache && (now - _usersCacheTime) < CACHE_TTL_MS) return _usersCache;
  try {
    if (!fs.existsSync(_usersFile)) {
      _usersCache = [];
      _usersCacheTime = now;
      return _usersCache;
    }
    const raw = fs.readFileSync(_usersFile, 'utf8');
    const parsed = JSON.parse(raw);
    _usersCache = parsed;
    _usersCacheTime = now;
    return _usersCache;
  } catch {
    _usersCache = [];
    _usersCacheTime = now;
    return _usersCache;
  }
}

function saveUsers(users) {
  _usersCache = users;
  _usersCacheTime = Date.now();
  fs.writeFileSync(_usersFile, JSON.stringify(users, null, 2), 'utf8');
}

function sanitizeUser(user) {
  const { passwordHash, ...safe } = user;
  return safe;
}

// ─── JWT secret ──────────────────────────────────────────────────────────────

let _jwtSecret = null;
function getJwtSecret() {
  if (_jwtSecret) return _jwtSecret;
  if (process.env.PKI_JWT_SECRET) {
    _jwtSecret = process.env.PKI_JWT_SECRET;
    return _jwtSecret;
  }
  // No secret configured — generate random per-boot and warn
  _jwtSecret = crypto.randomBytes(32).toString('hex');
  if (process.env.NODE_ENV === 'production') {
    logger.warn('[KI-OS Auth] WARNING: PKI_JWT_SECRET not set — using random per-boot secret. All sessions will be invalidated on restart. Set PKI_JWT_SECRET in production!');
  }
  return _jwtSecret;
}

// ─── In-memory session cache ──────────────────────────────────────────────────

const sessionCache = new Map();

// ─── First-boot admin creation ────────────────────────────────────────────────

let _booted = false;
function ensureBootstrap() {
  if (_booted) return;
  _booted = true;
  const users = loadUsers();
  if (users.length === 0) {
    const password = randomPassword(12);
    const now = new Date().toISOString();
    const admin = {
      id: crypto.randomUUID(),
      email: 'admin@ki-os.local',
      name: 'KI-OS Admin',
      role: 'admin',
      tenant: 'default',
      passwordHash: hashPassword(password),
      createdAt: now,
      updatedAt: now,
      active: true,
    };
    saveUsers([admin]);
    const lines = [
      '',
      '='.repeat(60),
      '  KI-OS Community Edition — First Boot',
      '  Default admin account created:',
      `    Email   : ${admin.email}`,
      `    Password: ${password}`,
      '  Change this password after your first login!',
      '='.repeat(60),
      '',
    ].join('\n');
    logger.info('[KI-OS Auth] First-boot admin account created', { email: admin.email, firstBootMessage: lines });
  }
}

// ─── Auth service public API ──────────────────────────────────────────────────

/**
 * Create a new user (admin only — caller must enforce role check).
 */
function createUser({ email, name, role = 'user', tenant = 'default', password }) {
  ensureBootstrap();
  if (!email || !password) throw Object.assign(new Error('email and password are required'), { statusCode: 400 });
  if (!VALID_ROLES.includes(role)) throw Object.assign(new Error(`Invalid role. Must be one of: ${VALID_ROLES.join(', ')}`), { statusCode: 400 });

  const users = loadUsers();
  if (users.find(u => u.email === email)) {
    throw Object.assign(new Error('User with this email already exists'), { statusCode: 409 });
  }
  const now = new Date().toISOString();
  const user = {
    id: crypto.randomUUID(),
    email,
    name: name || email.split('@')[0],
    role,
    tenant,
    passwordHash: hashPassword(password),
    createdAt: now,
    updatedAt: now,
    active: true,
  };
  users.push(user);
  saveUsers(users);
  return sanitizeUser(user);
}

/**
 * Get a user by email (returns full record including passwordHash — internal use).
 */
function getUserByEmail(email) {
  ensureBootstrap();
  const users = loadUsers();
  return users.find(u => u.email === email) || null;
}

/**
 * List all users (sanitized — no passwordHash).
 */
function listUsers() {
  ensureBootstrap();
  return loadUsers().map(sanitizeUser);
}

/**
 * Authenticate with email + password.
 * Returns { user (sanitized), token, refreshToken }.
 */
function authenticate(email, password) {
  ensureBootstrap();

  // Brute-force check
  const attempt = loginAttempts.get(email);
  if (attempt && attempt.lockedUntil > Date.now()) {
    const minutesLeft = Math.ceil((attempt.lockedUntil - Date.now()) / 60000);
    throw Object.assign(
      new Error(`Too many login attempts. Try again in ${minutesLeft} minute${minutesLeft !== 1 ? 's' : ''}.`),
      { statusCode: 429 }
    );
  }

  const user = getUserByEmail(email);
  if (!user || !user.active) {
    // Increment attempt counter even for unknown emails (prevent enumeration timing)
    const rec = loginAttempts.get(email) || { count: 0, lockedUntil: 0 };
    rec.count += 1;
    if (rec.count >= MAX_ATTEMPTS) rec.lockedUntil = Date.now() + LOCKOUT_MS;
    loginAttempts.set(email, rec);
    throw Object.assign(new Error('Invalid credentials'), { statusCode: 401 });
  }
  if (!verifyPassword(password, user.passwordHash)) {
    const rec = loginAttempts.get(email) || { count: 0, lockedUntil: 0 };
    rec.count += 1;
    if (rec.count >= MAX_ATTEMPTS) rec.lockedUntil = Date.now() + LOCKOUT_MS;
    loginAttempts.set(email, rec);
    throw Object.assign(new Error('Invalid credentials'), { statusCode: 401 });
  }

  // Successful login — clear attempts
  loginAttempts.delete(email);

  const secret = getJwtSecret();
  const sessionId = crypto.randomUUID();
  const token = JWT.sign(
    { sub: user.id, email: user.email, role: user.role, tenant: user.tenant, sessionId },
    secret,
    ACCESS_TOKEN_TTL
  );
  const refreshToken = JWT.sign(
    { sub: user.id, sessionId, type: 'refresh' },
    secret,
    REFRESH_TOKEN_TTL
  );
  sessionCache.set(sessionId, { userId: user.id, active: true, createdAt: Date.now() });

  // Prune stale sessions to prevent unbounded growth
  if (sessionCache.size > 1000) {
    const cutoff = Date.now() - (8 * 86400 * 1000);
    for (const [k, v] of sessionCache.entries()) {
      if (v.createdAt < cutoff) sessionCache.delete(k);
    }
  }

  return { user: sanitizeUser(user), token, refreshToken };
}

/**
 * Verify an access token. Returns the decoded payload.
 */
function verifyToken(token) {
  try {
    const payload = JWT.verify(token, getJwtSecret());
    if (payload.type === 'refresh') throw new Error('Refresh token cannot be used as access token');
    if (payload.sessionId) {
      const session = sessionCache.get(payload.sessionId);
      if (session && !session.active) throw new Error('Session invalidated');
    }
    return payload;
  } catch (err) {
    throw Object.assign(new Error(err.message || 'Invalid token'), { statusCode: 401 });
  }
}

/**
 * Refresh an access token using a valid refresh token.
 * Returns { user (sanitized), token }.
 */
function refreshToken(token) {
  let payload;
  try {
    payload = JWT.verify(token, getJwtSecret());
  } catch (err) {
    throw Object.assign(new Error('Invalid or expired refresh token'), { statusCode: 401 });
  }
  if (payload.type !== 'refresh') {
    throw Object.assign(new Error('Not a refresh token'), { statusCode: 401 });
  }
  if (payload.sessionId) {
    const session = sessionCache.get(payload.sessionId);
    if (session && !session.active) {
      throw Object.assign(new Error('Session invalidated'), { statusCode: 401 });
    }
  }
  const users = loadUsers();
  const user = users.find(u => u.id === payload.sub);
  if (!user || !user.active) {
    throw Object.assign(new Error('User not found or inactive'), { statusCode: 401 });
  }
  const newToken = JWT.sign(
    { sub: user.id, email: user.email, role: user.role, tenant: user.tenant, sessionId: payload.sessionId },
    getJwtSecret(),
    ACCESS_TOKEN_TTL
  );
  return { user: sanitizeUser(user), token: newToken };
}

/**
 * Invalidate a session by token (logout).
 */
function invalidateToken(token) {
  try {
    const payload = JWT.verify(token, getJwtSecret());
    if (payload.sessionId) {
      const session = sessionCache.get(payload.sessionId) || { userId: payload.sub, createdAt: Date.now() };
      sessionCache.set(payload.sessionId, { ...session, active: false });
    }
  } catch {
    // Best-effort — ignore invalid tokens on logout
  }
}

/**
 * Update allowed fields on an existing user.
 */
function updateUser(id, updates) {
  const users = loadUsers();
  const idx = users.findIndex(u => u.id === id);
  if (idx === -1) throw Object.assign(new Error('User not found'), { statusCode: 404 });
  const allowed = ['name', 'role', 'tenant', 'active'];
  const changed = {};
  for (const k of allowed) {
    if (k in updates) changed[k] = updates[k];
  }
  if (changed.role && !VALID_ROLES.includes(changed.role)) {
    throw Object.assign(new Error(`Invalid role: ${changed.role}`), { statusCode: 400 });
  }
  users[idx] = { ...users[idx], ...changed, updatedAt: new Date().toISOString() };
  saveUsers(users);
  return sanitizeUser(users[idx]);
}

/**
 * Change a user's password after verifying the current one.
 */
function changePassword(id, currentPassword, newPassword) {
  const users = loadUsers();
  const user = users.find(u => u.id === id);
  if (!user) throw Object.assign(new Error('User not found'), { statusCode: 404 });
  if (!verifyPassword(currentPassword, user.passwordHash)) {
    throw Object.assign(new Error('Current password is incorrect'), { statusCode: 401 });
  }
  if (!newPassword || newPassword.length < 8) {
    throw Object.assign(new Error('New password must be at least 8 characters'), { statusCode: 400 });
  }
  user.passwordHash = hashPassword(newPassword);
  user.updatedAt = new Date().toISOString();
  saveUsers(users);
}

/**
 * Extract Bearer token from Authorization header value.
 */
function extractBearer(authHeader) {
  if (!authHeader) return null;
  const match = String(authHeader).match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : null;
}

/**
 * Override the users file path — for testing only.
 */
function _setUsersFile(filePath) {
  _usersFile = filePath;
  _usersCache = null;
  _usersCacheTime = 0;
  _booted = false;
}

module.exports = {
  createUser,
  getUserByEmail,
  listUsers,
  authenticate,
  verifyToken,
  refreshToken,
  invalidateToken,
  extractBearer,
  sanitizeUser,
  updateUser,
  changePassword,
  _setUsersFile,
};
