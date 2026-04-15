/**
 * KI-OS — (C) 2026 Ingo Schaffer
 * https://ki-os.org
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("L2 trust route exists and trust response is derived from saved run data", async () => {
  const routePath = path.join(process.cwd(), "frontend", "orbit-control", "app", "api", "trust", "route.ts");
  assert.equal(fs.existsSync(routePath), true);
  const runtime = await import("file://" + path.join(process.cwd(), "frontend", "orbit-control", "lib", "runtime", "ui-runtime-service.mjs"));
  runtime.uiRuntimeService.reset();
  const created = runtime.uiRuntimeService.createRuntimeRun({ confidence: 0.92 });
  const trust = runtime.uiRuntimeService.buildTrustResponse(created.runId);
  assert.equal(trust.runId, created.runId);
  assert.equal(trust.trustStatus, "green");
});
