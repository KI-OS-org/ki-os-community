import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "../..");

const liveAdapters = [
  "frontend/orbit-control/lib/adapters/control-plane.ts",
  "frontend/orbit-control/lib/adapters/governance-studio.ts",
  "frontend/orbit-control/lib/adapters/economic.ts",
  "frontend/orbit-control/lib/adapters/federation.ts",
  "frontend/orbit-control/lib/adapters/retail.ts",
  "frontend/orbit-control/lib/adapters/workspace.ts",
  "frontend/orbit-control/lib/adapters/mission-control.ts",
  "frontend/orbit-control/lib/adapters/explain-trust.ts",
  "frontend/orbit-control/lib/adapters/flow-studio.ts",
  "frontend/orbit-control/lib/adapters/integrations.ts",
  "frontend/orbit-control/lib/adapters/files-memory.ts",
  "frontend/orbit-control/lib/adapters/packs.ts",
  "frontend/orbit-control/lib/adapters/solutions.ts",
  "frontend/orbit-control/lib/adapters/templates.ts",
  "frontend/orbit-control/lib/adapters/tenant.ts",
  "frontend/orbit-control/lib/adapters/webhooks.ts",
  "frontend/orbit-control/lib/adapters/connector-fabric.ts",
  "frontend/orbit-control/lib/adapters/whiteboard.ts",
];

test("RC1.7 live adapters contain orbitFetch", async () => {
  for (const file of liveAdapters) {
    const content = fs.readFileSync(path.join(root, file), "utf8");
    assert.match(content, /orbitFetch/);
  }
});
