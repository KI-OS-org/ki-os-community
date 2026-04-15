/**
 * KI-OS — (C) 2026 Ingo Schaffer
 * https://ki-os.org
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("L2 run-create route exists and runtime service creates linked artifacts", async () => {
  const routePath = path.join(process.cwd(), "frontend", "orbit-control", "app", "api", "runtime", "runs", "create", "route.ts");
  assert.equal(fs.existsSync(routePath), true);
  const runtime = await import("file://" + path.join(process.cwd(), "frontend", "orbit-control", "lib", "runtime", "ui-runtime-service.mjs"));
  runtime.uiRuntimeService.reset();
  const created = runtime.uiRuntimeService.createRuntimeRun({ summary: "Create route test" });
  assert.equal(Boolean(created.runId), true);
  assert.equal(Boolean(created.memoryId), true);
  assert.equal(Boolean(created.fileId), true);
});
