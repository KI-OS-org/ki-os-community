import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");

test("RC1.3 frontend is physically present", async () => {
  assert.equal(fs.existsSync(path.join(root, "frontend", "orbit-control", "package.json")), true);
  assert.equal(fs.existsSync(path.join(root, "frontend", "orbit-control", "app")), true);
  assert.equal(fs.existsSync(path.join(root, "frontend", "orbit-control", "components")), true);
  assert.equal(fs.existsSync(path.join(root, "frontend", "orbit-control", "lib", "adapters")), true);
});

test("RC1.3 secrets file removed", async () => {
  assert.equal(fs.existsSync(path.join(root, "Secrets.bat")), false);
});

test("RC1.3 launchers reference RC1.3 and release gate", async () => {
  const bat = fs.readFileSync(path.join(root, "KI-OS-Start.bat"), "utf8");
  assert.match(bat, /RC1\.3/);
  assert.match(bat, /release-gate-rc1\.3\.js/);
});
