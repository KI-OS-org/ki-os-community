/**
 * KI-OS — (C) 2026 Ingo Schaffer
 * https://ki-os.org
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("L2 explain route exists and explain response comes from saved run data", async () => {
  const routePath = path.join(process.cwd(), "frontend", "orbit-control", "app", "api", "explain", "route.ts");
  assert.equal(fs.existsSync(routePath), true);
  const runtime = await import("file://" + path.join(process.cwd(), "frontend", "orbit-control", "lib", "runtime", "ui-runtime-service.mjs"));
  runtime.uiRuntimeService.reset();
  const created = runtime.uiRuntimeService.createRuntimeRun({ routingReason: "test-reason", summary: "Explain me" });
  const explain = runtime.uiRuntimeService.buildExplainResponse(created.runId);
  assert.equal(explain.runId, created.runId);
  assert.equal(explain.routingReason, "test-reason");
  assert.equal(Array.isArray(explain.policyChecks), true);
});
