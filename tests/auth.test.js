/**
 * (c) 2026 KI-OS.org (v6.0) by Ingo Schaffer und Kimba
 * Datei: auth.test.js
 * Diese Datei enthält automatisierte Tests zur Verifikation von Verhalten, Stabilität und Regressionen im KI-OS AgentMesh.
 */

'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

// ─── Test helpers ─────────────────────────────────────────────────────────────

function makeTempFile() {
  return path.join(os.tmpdir(), `ki-os-test-users-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
}

function freshService(tmpFile) {
  // Clear require cache so we get a clean module state per test
  const svcPath = require.resolve('../backend/services/auth/local.auth.service');
  delete require.cache[svcPath];
  const svc = require('../backend/services/auth/local.auth.service');
  svc._setUsersFile(tmpFile);
  return svc;
}

function freshController(svc) {
  const ctrlPath = require.resolve('../backend/services/auth/auth.controller');
  delete require.cache[ctrlPath];
  // Patch the controller's dependency to use our isolated service instance
  // by temporarily replacing the cached module
  const svcPath = require.resolve('../backend/services/auth/local.auth.service');
  require.cache[svcPath] = { id: svcPath, filename: svcPath, loaded: true, exports: svc };
  const ctrl = require('../backend/services/auth/auth.controller');
  return ctrl;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

test('1. Bootstrap: empty users file → admin created', () => {
  const tmp = makeTempFile();
  const svc = freshService(tmp);
  const users = svc.listUsers();
  assert.equal(users.length, 1);
  assert.equal(users[0].email, 'admin@ki-os.local');
  assert.equal(users[0].role, 'admin');
  assert.equal(typeof users[0].passwordHash, 'undefined', 'passwordHash must not be exposed by listUsers');
  fs.unlinkSync(tmp);
});

test('2. Authenticate: correct credentials → token returned', () => {
  const tmp = makeTempFile();
  const svc = freshService(tmp);
  // Bootstrap creates admin with unknown password — create a test user instead
  const created = svc.createUser({ email: 'test@ki-os.local', name: 'Test', role: 'user', tenant: 'default', password: 'testpass123' });
  const result = svc.authenticate('test@ki-os.local', 'testpass123');
  assert.ok(result.token, 'token must be present');
  assert.ok(result.refreshToken, 'refreshToken must be present');
  assert.equal(result.user.email, 'test@ki-os.local');
  assert.equal(typeof result.user.passwordHash, 'undefined', 'passwordHash must not be in returned user');
  fs.unlinkSync(tmp);
});

test('3. Authenticate: wrong password → 401', () => {
  const tmp = makeTempFile();
  const svc = freshService(tmp);
  svc.createUser({ email: 'u@ki-os.local', name: 'U', role: 'user', tenant: 'default', password: 'correct123' });
  assert.throws(
    () => svc.authenticate('u@ki-os.local', 'wrongpass'),
    (err) => err.statusCode === 401
  );
  fs.unlinkSync(tmp);
});

test('4. Authenticate: unknown email → 401', () => {
  const tmp = makeTempFile();
  const svc = freshService(tmp);
  assert.throws(
    () => svc.authenticate('nobody@ki-os.local', 'anypass'),
    (err) => err.statusCode === 401
  );
  fs.unlinkSync(tmp);
});

test('5. verifyToken: valid token → payload returned', () => {
  const tmp = makeTempFile();
  const svc = freshService(tmp);
  svc.createUser({ email: 'v@ki-os.local', name: 'V', role: 'user', tenant: 'default', password: 'pass12345' });
  const { token } = svc.authenticate('v@ki-os.local', 'pass12345');
  const payload = svc.verifyToken(token);
  assert.equal(payload.email, 'v@ki-os.local');
  assert.ok(payload.sub, 'sub must be present');
  fs.unlinkSync(tmp);
});

test('6. verifyToken: expired token → throws', () => {
  const tmp = makeTempFile();
  const svc = freshService(tmp);
  // Build an already-expired token manually using internal JWT class
  // We do this by signing with a very short expiry in the past via a tampered payload
  const crypto = require('crypto');
  const secret = process.env.PKI_JWT_SECRET || (() => {
    // read the secret the service will use by authenticating once
    svc.createUser({ email: 'exp@ki-os.local', name: 'Exp', role: 'user', tenant: 'default', password: 'pass12345' });
    const { token } = svc.authenticate('exp@ki-os.local', 'pass12345');
    // The token header.payload.sig — we can extract secret indirectly by verifying, but
    // instead let's craft an expired token by constructing with known secret
    return null;
  })();

  // Simpler approach: create a helper token with manipulated exp in past
  // We'll use the service's own internal by monkey-patching Date.now temporarily
  if (!fs.existsSync(tmp)) fs.writeFileSync(tmp, '[]', 'utf8');
  svc.createUser({ email: 'exp2@ki-os.local', name: 'Exp2', role: 'user', tenant: 'default', password: 'pass12345' });

  const realNow = Date.now;
  // Shift time 2 hours back so token is issued in past with 1h expiry
  Date.now = () => realNow() - (2 * 3600 * 1000);
  let expiredToken;
  try {
    const result = svc.authenticate('exp2@ki-os.local', 'pass12345');
    expiredToken = result.token;
  } finally {
    Date.now = realNow;
  }

  assert.throws(
    () => svc.verifyToken(expiredToken),
    (err) => err.statusCode === 401 && /expired/i.test(err.message)
  );
  fs.unlinkSync(tmp);
});

test('7. verifyToken: tampered token → throws', () => {
  const tmp = makeTempFile();
  const svc = freshService(tmp);
  svc.createUser({ email: 't@ki-os.local', name: 'T', role: 'user', tenant: 'default', password: 'pass12345' });
  const { token } = svc.authenticate('t@ki-os.local', 'pass12345');
  const parts = token.split('.');
  // Flip last char of signature
  const sig = parts[2];
  parts[2] = sig.slice(0, -1) + (sig.slice(-1) === 'A' ? 'B' : 'A');
  const tampered = parts.join('.');
  assert.throws(
    () => svc.verifyToken(tampered),
    (err) => err.statusCode === 401
  );
  fs.unlinkSync(tmp);
});

test('8. refreshToken: valid refresh → new access token', () => {
  const tmp = makeTempFile();
  const svc = freshService(tmp);
  svc.createUser({ email: 'r@ki-os.local', name: 'R', role: 'user', tenant: 'default', password: 'pass12345' });
  const { refreshToken } = svc.authenticate('r@ki-os.local', 'pass12345');
  const result = svc.refreshToken(refreshToken);
  assert.ok(result.token, 'new access token must be returned');
  assert.equal(result.user.email, 'r@ki-os.local');
  fs.unlinkSync(tmp);
});

test('9. refreshToken: access token as refresh → throws', () => {
  const tmp = makeTempFile();
  const svc = freshService(tmp);
  svc.createUser({ email: 'ra@ki-os.local', name: 'RA', role: 'user', tenant: 'default', password: 'pass12345' });
  const { token } = svc.authenticate('ra@ki-os.local', 'pass12345');
  assert.throws(
    () => svc.refreshToken(token),
    (err) => err.statusCode === 401
  );
  fs.unlinkSync(tmp);
});

test('10. invalidateToken: logout → session marked inactive → verifyToken fails', () => {
  const tmp = makeTempFile();
  const svc = freshService(tmp);
  svc.createUser({ email: 'lo@ki-os.local', name: 'Lo', role: 'user', tenant: 'default', password: 'pass12345' });
  const { token } = svc.authenticate('lo@ki-os.local', 'pass12345');
  // Token valid before logout
  assert.ok(svc.verifyToken(token));
  svc.invalidateToken(token);
  // Token must fail after logout
  assert.throws(
    () => svc.verifyToken(token),
    (err) => err.statusCode === 401 && /invalidated/i.test(err.message)
  );
  fs.unlinkSync(tmp);
});

test('11. createUser: valid data → sanitized user (no passwordHash)', () => {
  const tmp = makeTempFile();
  const svc = freshService(tmp);
  const user = svc.createUser({ email: 'new@ki-os.local', name: 'New', role: 'operator', tenant: 'ops', password: 'pass12345' });
  assert.equal(user.email, 'new@ki-os.local');
  assert.equal(user.role, 'operator');
  assert.equal(typeof user.passwordHash, 'undefined', 'passwordHash must not be returned');
  fs.unlinkSync(tmp);
});

test('12. createUser: duplicate email → 409', () => {
  const tmp = makeTempFile();
  const svc = freshService(tmp);
  svc.createUser({ email: 'dup@ki-os.local', name: 'Dup', role: 'user', tenant: 'default', password: 'pass12345' });
  assert.throws(
    () => svc.createUser({ email: 'dup@ki-os.local', name: 'Dup2', role: 'user', tenant: 'default', password: 'pass12345' }),
    (err) => err.statusCode === 409
  );
  fs.unlinkSync(tmp);
});

test('13. createUser: invalid role → 400', () => {
  const tmp = makeTempFile();
  const svc = freshService(tmp);
  assert.throws(
    () => svc.createUser({ email: 'badrole@ki-os.local', name: 'Bad', role: 'superuser', tenant: 'default', password: 'pass12345' }),
    (err) => err.statusCode === 400
  );
  fs.unlinkSync(tmp);
});

test('14. updateUser: change name → persisted', () => {
  const tmp = makeTempFile();
  const svc = freshService(tmp);
  const created = svc.createUser({ email: 'upd@ki-os.local', name: 'Old Name', role: 'user', tenant: 'default', password: 'pass12345' });
  const updated = svc.updateUser(created.id, { name: 'New Name' });
  assert.equal(updated.name, 'New Name');
  assert.equal(updated.email, 'upd@ki-os.local');
  // Verify persistence: reload via listUsers
  const found = svc.listUsers().find(u => u.id === created.id);
  assert.equal(found.name, 'New Name');
  fs.unlinkSync(tmp);
});

test('15. changePassword: correct old pw → success; wrong old pw → 401', () => {
  const tmp = makeTempFile();
  const svc = freshService(tmp);
  const user = svc.createUser({ email: 'pw@ki-os.local', name: 'PW', role: 'user', tenant: 'default', password: 'oldpass123' });
  // Correct old password → success
  svc.changePassword(user.id, 'oldpass123', 'newpass456');
  // New password now works for auth
  const result = svc.authenticate('pw@ki-os.local', 'newpass456');
  assert.ok(result.token, 'should authenticate with new password');
  // Wrong old password → 401
  assert.throws(
    () => svc.changePassword(user.id, 'wrongold', 'anothernew'),
    (err) => err.statusCode === 401
  );
  fs.unlinkSync(tmp);
});

test('16. Brute force: 5 failures → 429 on 6th attempt', () => {
  const tmp = makeTempFile();
  const svc = freshService(tmp);
  svc.createUser({ email: 'bf@ki-os.local', name: 'BF', role: 'user', tenant: 'default', password: 'realpass123' });
  // Fail 5 times
  for (let i = 0; i < 5; i++) {
    assert.throws(
      () => svc.authenticate('bf@ki-os.local', 'wrongpass'),
      (err) => err.statusCode === 401
    );
  }
  // 6th attempt should be locked out (429)
  assert.throws(
    () => svc.authenticate('bf@ki-os.local', 'realpass123'),
    (err) => err.statusCode === 429 && /too many/i.test(err.message)
  );
  fs.unlinkSync(tmp);
});

test('17. auth.controller: POST /auth/login → 200 with token', async () => {
  const tmp = makeTempFile();
  const svc = freshService(tmp);
  svc.createUser({ email: 'ctrl@ki-os.local', name: 'Ctrl', role: 'user', tenant: 'default', password: 'pass12345' });
  const ctrl = freshController(svc);
  const res = await ctrl.handleAuthRequest('/auth/login', 'POST', { email: 'ctrl@ki-os.local', password: 'pass12345' }, {});
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.ok(res.body.token, 'token must be in response');
  fs.unlinkSync(tmp);
});

test('18. auth.controller: GET /auth/me with valid token → user', async () => {
  const tmp = makeTempFile();
  const svc = freshService(tmp);
  svc.createUser({ email: 'me@ki-os.local', name: 'Me', role: 'user', tenant: 'default', password: 'pass12345' });
  const { token } = svc.authenticate('me@ki-os.local', 'pass12345');
  const ctrl = freshController(svc);
  const res = await ctrl.handleAuthRequest('/auth/me', 'GET', {}, { authorization: `Bearer ${token}` });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.user.email, 'me@ki-os.local');
  fs.unlinkSync(tmp);
});

test('19. auth.controller: POST /auth/users without admin → 403', async () => {
  const tmp = makeTempFile();
  const svc = freshService(tmp);
  svc.createUser({ email: 'nonadmin@ki-os.local', name: 'NonAdmin', role: 'user', tenant: 'default', password: 'pass12345' });
  const { token } = svc.authenticate('nonadmin@ki-os.local', 'pass12345');
  const ctrl = freshController(svc);
  const res = await ctrl.handleAuthRequest(
    '/auth/users',
    'POST',
    { email: 'new@ki-os.local', name: 'New', role: 'user', tenant: 'default', password: 'pass12345' },
    { authorization: `Bearer ${token}` }
  );
  assert.equal(res.statusCode, 403);
  assert.equal(res.body.success, false);
  fs.unlinkSync(tmp);
});
