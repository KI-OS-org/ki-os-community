import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

test("L2 adapter coverage contains live-light explain/trust/files/memory routes", () => {
  const root = process.cwd();
  const required = [
    "frontend/orbit-control/app/api/runtime/runs/create/route.ts",
    "frontend/orbit-control/app/api/explain/route.ts",
    "frontend/orbit-control/app/api/trust/route.ts",
    "frontend/orbit-control/app/api/files/route.ts",
    "frontend/orbit-control/app/api/memory/retrieve/route.ts"
  ];
  for (const rel of required) {
    assert.equal(fs.existsSync(path.join(root, rel)), true, rel);
  }
});
