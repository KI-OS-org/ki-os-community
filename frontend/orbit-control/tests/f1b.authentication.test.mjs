import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

test("F1b wires Auth.js entrypoints and middleware", () => {
  const authTs = read("auth.ts");
  const middleware = read("middleware.ts");
  assert.match(authTs, /NextAuth/);
  assert.match(authTs, /Credentials/);
  assert.match(authTs, /callbacks:/);
  assert.match(middleware, /matcher/);
});

test("F1b ships login UI and role guard", () => {
  const loginPage = read("app/login/page.tsx");
  const loginForm = read("components/auth/login-form.tsx");
  const roleGuard = read("components/auth/role-guard.tsx");
  assert.match(loginPage, /Orbit Login/);
  assert.match(loginForm, /signIn\("credentials"/);
  assert.match(roleGuard, /allowedRoles/);
});

test("F1b header exposes auth status and tenant switcher", () => {
  const header = read("components/orbit/orbit-header.tsx");
  const authStatus = read("components/auth/auth-status.tsx");
  const tenantSwitcher = read("components/auth/tenant-switcher.tsx");
  assert.match(header, /AuthStatus/);
  assert.match(authStatus, /TenantSwitcher/);
  assert.match(tenantSwitcher, /api\/tenant/);
});

test("F1b defines adapter layer modules mandated by blueprint", () => {
  const adapterIndex = read("lib/adapters/index.ts");
  ["workspace", "governance", "routing", "economic", "tenant", "packs", "federation", "operations", "retail", "integrations", "webhooks", "mappings"].forEach((name) => {
    assert.match(adapterIndex, new RegExp(name));
    assert.equal(fs.existsSync(path.join(root, `lib/adapters/${name}.ts`)), true);
  });
});

test("F1b package test command includes authentication suite", () => {
  const packageJson = JSON.parse(read("package.json"));
  assert.match(packageJson.scripts.test, /f1b\.authentication/);
  assert.match(packageJson.version, /f1b|f2/);
});
