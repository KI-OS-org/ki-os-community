/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
// (c) 2026 KI-OS.org by Ingo Schaffer und Kimba
// @license AGPL-3.0-only
// @file auth.community.service.js
// @desc SQLite+bcryptjs Auth Service für KI-OS Community Edition

'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const logger = require('../core/logger.service');

const DB_PATH = path.join(process.cwd(), 'data', 'ki-os-auth.db');
const ACCESS_TOKEN_TTL = '1h';
const REFRESH_TOKEN_TTL = '7d';
const BCRYPT_ROUNDS = 10;
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;
const VALID_ROLES = ['admin', 'operator', 'auditor', 'user'];

const loginAttempts = new Map();

let db = null;
let statements = null;
let bootstrapped = false;
let jwtSecret = null;

function getJwtSecret() {
  if (jwtSecret) return jwtSecret;

  jwtSecret = process.env.PKI_JWT_SECRET || process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');
  if (!process.env.PKI_JWT_SECRET && !process.env.JWT_SECRET) {
    logger.warn('[KI-OS Auth] PKI_JWT_SECRET/JWT_SECRET not set - using random per-boot secret. Sessions will be invalidated on restart.');
  }

  return jwtSecret;
}

function randomPassword(length = 12) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
  return Array.from(crypto.randomBytes(length))
    .map(byte => chars[byte % chars.length])
    .join('');
}

function hashPassword(password) {
  return bcrypt.hashSync(password, BCRYPT_ROUNDS);
}

function verifyPassword(password, passwordHash) {
  if (!password || !passwordHash) return false;
  return bcrypt.compareSync(password, passwordHash);
}

function toUser(row) {
  if (!row) return null;
  return {
    ...row,
    active: Boolean(row.active),
  };
}

function sanitizeUser(user) {
  if (!user) return user;
  const { passwordHash, ...safe } = user;
  return safe;
}

function getDb() {
  if (db) return db;

  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      name TEXT,
      role TEXT DEFAULT 'user',
      tenant TEXT DEFAULT 'default',
      passwordHash TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      active INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS sessions (
      sessionId TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      active INTEGER DEFAULT 1,
      createdAt INTEGER NOT NULL
    );
  `);

  statements = {
    countUsers: db.prepare('SELECT COUNT(*) AS count FROM users'),
    insertUser: db.prepare(`
      INSERT INTO users (id, email, name, role, tenant, passwordHash, createdAt, updatedAt, active)
      VALUES (@id, @email, @name, @role, @tenant, @passwordHash, @createdAt, @updatedAt, @active)
    `),
    getUserByEmail: db.prepare(`
      SELECT id, email, name, role, tenant, passwordHash, createdAt, updatedAt, active
      FROM users
      WHERE email = ?
    `),
    getUserById: db.prepare(`
      SELECT id, email, name, role, tenant, passwordHash, createdAt, updatedAt, active
      FROM users
      WHERE id = ?
    `),
    listUsers: db.prepare(`
      SELECT id, email, name, role, tenant, passwordHash, createdAt, updatedAt, active
      FROM users
      ORDER BY createdAt ASC
    `),
    updateUser: db.prepare(`
      UPDATE users
      SET name = @name,
          role = @role,
          tenant = @tenant,
          active = @active,
          updatedAt = @updatedAt
      WHERE id = @id
    `),
    updatePassword: db.prepare(`
      UPDATE users
      SET passwordHash = ?, updatedAt = ?
      WHERE id = ?
    `),
    insertSession: db.prepare(`
      INSERT INTO sessions (sessionId, userId, active, createdAt)
      VALUES (?, ?, 1, ?)
    `),
    getSessionById: db.prepare(`
      SELECT sessionId, userId, active, createdAt
      FROM sessions
      WHERE sessionId = ?
    `),
    deactivateSession: db.prepare(`
      UPDATE sessions
      SET active = 0
      WHERE sessionId = ?
    `),
    pruneSessions: db.prepare(`
      DELETE FROM sessions
      WHERE createdAt < ? AND active = 0
    `),
  };

  return db;
}

function ensureBootstrap() {
  if (bootstrapped) return;

  getDb();
  bootstrapped = true;
  const { count } = statements.countUsers.get();
  if (count > 0) return;

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
    active: 1,
  };

  statements.insertUser.run(admin);

  const lines = [
    '',
    '='.repeat(60),
    '  KI-OS Community Edition - First Boot',
    '  Default admin account created:',
    `    Email   : ${admin.email}`,
    `    Password: ${password}`,
    '  Change this password after your first login!',
    '='.repeat(60),
    '',
  ].join('\n');

  console.log(lines);
  logger.info('[KI-OS Auth] First-boot admin account created', { email: admin.email });
}

function signAccessToken(user, sessionId) {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      role: user.role,
      tenant: user.tenant,
      sessionId,
    },
    getJwtSecret(),
    {
      algorithm: 'HS256',
      expiresIn: ACCESS_TOKEN_TTL,
    }
  );
}

function signRefreshToken(userId, sessionId) {
  return jwt.sign(
    {
      sub: userId,
      sessionId,
      type: 'refresh',
    },
    getJwtSecret(),
    {
      algorithm: 'HS256',
      expiresIn: REFRESH_TOKEN_TTL,
    }
  );
}

function verifyJwt(token) {
  return jwt.verify(token, getJwtSecret(), { algorithms: ['HS256'] });
}

function getSession(sessionId) {
  if (!sessionId) return null;
  return statements.getSessionById.get(sessionId) || null;
}

function assertSessionActive(sessionId) {
  const session = getSession(sessionId);
  if (!session || !session.active) {
    throw Object.assign(new Error('Session invalidated'), { statusCode: 401 });
  }
  return session;
}

function createUser({ email, name, role = 'user', tenant = 'default', password }) {
  ensureBootstrap();

  if (!email || !password) {
    throw Object.assign(new Error('email and password are required'), { statusCode: 400 });
  }
  if (!VALID_ROLES.includes(role)) {
    throw Object.assign(new Error(`Invalid role. Must be one of: ${VALID_ROLES.join(', ')}`), { statusCode: 400 });
  }

  const existingUser = statements.getUserByEmail.get(email);
  if (existingUser) {
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
    active: 1,
  };

  statements.insertUser.run(user);
  return sanitizeUser(toUser(user));
}

function getUserByEmail(email) {
  ensureBootstrap();
  return toUser(statements.getUserByEmail.get(email));
}

function listUsers() {
  ensureBootstrap();
  return statements.listUsers.all().map(row => sanitizeUser(toUser(row)));
}

function authenticate(email, password) {
  ensureBootstrap();

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
    const record = loginAttempts.get(email) || { count: 0, lockedUntil: 0 };
    record.count += 1;
    if (record.count >= MAX_ATTEMPTS) record.lockedUntil = Date.now() + LOCKOUT_MS;
    loginAttempts.set(email, record);
    throw Object.assign(new Error('Invalid credentials'), { statusCode: 401 });
  }

  if (!verifyPassword(password, user.passwordHash)) {
    const record = loginAttempts.get(email) || { count: 0, lockedUntil: 0 };
    record.count += 1;
    if (record.count >= MAX_ATTEMPTS) record.lockedUntil = Date.now() + LOCKOUT_MS;
    loginAttempts.set(email, record);
    throw Object.assign(new Error('Invalid credentials'), { statusCode: 401 });
  }

  loginAttempts.delete(email);

  const sessionId = crypto.randomUUID();
  const createdAt = Date.now();
  statements.insertSession.run(sessionId, user.id, createdAt);
  statements.pruneSessions.run(createdAt - (8 * 24 * 60 * 60 * 1000));

  return {
    user: sanitizeUser(user),
    token: signAccessToken(user, sessionId),
    refreshToken: signRefreshToken(user.id, sessionId),
  };
}

function verifyToken(token) {
  try {
    const payload = verifyJwt(token);
    if (payload.type === 'refresh') {
      throw new Error('Refresh token cannot be used as access token');
    }
    if (payload.sessionId) {
      assertSessionActive(payload.sessionId);
    }
    return payload;
  } catch (err) {
    throw Object.assign(new Error(err.message || 'Invalid token'), { statusCode: 401 });
  }
}

function refreshToken(token) {
  let payload;
  try {
    payload = verifyJwt(token);
  } catch {
    throw Object.assign(new Error('Invalid or expired refresh token'), { statusCode: 401 });
  }

  if (payload.type !== 'refresh') {
    throw Object.assign(new Error('Not a refresh token'), { statusCode: 401 });
  }

  if (payload.sessionId) {
    assertSessionActive(payload.sessionId);
  }

  const user = toUser(statements.getUserById.get(payload.sub));
  if (!user || !user.active) {
    throw Object.assign(new Error('User not found or inactive'), { statusCode: 401 });
  }

  return {
    user: sanitizeUser(user),
    token: signAccessToken(user, payload.sessionId),
  };
}

function invalidateToken(token) {
  try {
    const payload = verifyJwt(token);
    if (payload.sessionId) {
      statements.deactivateSession.run(payload.sessionId);
    }
  } catch {
    // Best-effort logout.
  }
}

function updateUser(id, updates) {
  ensureBootstrap();

  const existingUser = toUser(statements.getUserById.get(id));
  if (!existingUser) {
    throw Object.assign(new Error('User not found'), { statusCode: 404 });
  }

  const allowed = ['name', 'role', 'tenant', 'active'];
  const changed = {};
  for (const key of allowed) {
    if (Object.prototype.hasOwnProperty.call(updates, key)) {
      changed[key] = updates[key];
    }
  }

  if (changed.role && !VALID_ROLES.includes(changed.role)) {
    throw Object.assign(new Error(`Invalid role: ${changed.role}`), { statusCode: 400 });
  }

  const nextUser = {
    ...existingUser,
    ...changed,
    active: Object.prototype.hasOwnProperty.call(changed, 'active') ? Boolean(changed.active) : existingUser.active,
    updatedAt: new Date().toISOString(),
  };

  statements.updateUser.run({
    id: nextUser.id,
    name: nextUser.name,
    role: nextUser.role,
    tenant: nextUser.tenant,
    active: nextUser.active ? 1 : 0,
    updatedAt: nextUser.updatedAt,
  });

  return sanitizeUser(nextUser);
}

function changePassword(id, currentPassword, newPassword) {
  ensureBootstrap();

  const user = toUser(statements.getUserById.get(id));
  if (!user) {
    throw Object.assign(new Error('User not found'), { statusCode: 404 });
  }
  if (!verifyPassword(currentPassword, user.passwordHash)) {
    throw Object.assign(new Error('Current password is incorrect'), { statusCode: 401 });
  }
  if (!newPassword || newPassword.length < 8) {
    throw Object.assign(new Error('New password must be at least 8 characters'), { statusCode: 400 });
  }

  statements.updatePassword.run(hashPassword(newPassword), new Date().toISOString(), id);
}

function extractBearer(authHeader) {
  if (!authHeader) return null;
  const match = String(authHeader).match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : null;
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
};
