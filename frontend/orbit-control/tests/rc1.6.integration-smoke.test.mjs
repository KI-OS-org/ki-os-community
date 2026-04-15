import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "../..");

test("critical live adapters exist and are wired", async () => {
  const files = [
    "frontend/orbit-control/lib/adapters/control-plane.ts",
    "frontend/orbit-control/lib/adapters/governance-studio.ts",
    "frontend/orbit-control/lib/adapters/economic.ts",
    "frontend/orbit-control/lib/adapters/federation.ts",
    "frontend/orbit-control/lib/adapters/retail.ts",
    "frontend/orbit-control/lib/adapters/workspace.ts",
    "frontend/orbit-control/lib/adapters/mission-control.ts",
  ];
  for (const file of files) {
    const content = fs.readFileSync(path.join(root, file), "utf8");
    assert.match(content, /orbitFetch/);
  }
});
