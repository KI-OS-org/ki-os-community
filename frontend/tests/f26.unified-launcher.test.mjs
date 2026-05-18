import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "../..");

test("F26 launcher files exist", async () => {
  const expected = [
    "frontend/orbit-control/scripts/KI-OS-Start.bat",
    "frontend/orbit-control/scripts/KI-OS-Start.ps1",
    "frontend/orbit-control/scripts/ki-os-start.mjs",
    "docs/F26_UNIFIED_DEV_PILOT_LAUNCHER.md",
    "Dokumentation/F26_BUILD_REPORT.md",
    "CLAUDE-QA/F26_HANDOFF.md"
  ];
  for (const file of expected) {
    assert.equal(fs.existsSync(path.join(root, file)), true);
  }
});

test("F26 batch file contains backend then frontend sequence", async () => {
  const batch = fs.readFileSync(path.join(root, "frontend/orbit-control/scripts/KI-OS-Start.bat"), "utf8");
  assert.match(batch, /Backend starten/);
  assert.match(batch, /Frontend starten/);
  assert.match(batch, /KI-OS-Start/);
});

test("F26 node launcher waits for backend", async () => {
  const js = fs.readFileSync(path.join(root, "frontend/orbit-control/scripts/ki-os-start.mjs"), "utf8");
  assert.match(js, /waitForBackend/);
  assert.match(js, /npm", \["run", "dev"\]/);
});
