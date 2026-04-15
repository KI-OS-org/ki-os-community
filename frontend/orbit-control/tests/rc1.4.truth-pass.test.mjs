import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "../..");

test("RC1.4 capability matrix exists", async () => {
  const content = fs.readFileSync(path.join(root, "Dokumentation/RC1_4_CAPABILITY_MATRIX.md"), "utf8");
  assert.match(content, /## LIVE/);
  assert.match(content, /## DEMO/);
});

test("RC1.4 manifest references physical frontend files", async () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, "FRONTEND_BUNDLE_MANIFEST.json"), "utf8"));
  assert.ok(Array.isArray(manifest.frontend_files));
  assert.ok(manifest.frontend_files.length > 0);
  for (const rel of manifest.frontend_files.slice(0, 10)) {
    assert.equal(fs.existsSync(path.join(root, rel)), true);
  }
});

test("RC1.4 release gate file exists", async () => {
  assert.equal(fs.existsSync(path.join(root, "scripts/release-gate-rc1.4.js")), true);
});
