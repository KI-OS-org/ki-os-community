/**
 * KI-OS — (C) 2026 Ingo Schaffer
 * https://ki-os.org
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

test("L2 trace store can create and find runtime runs", async () => {
  const runtime = await import("file://" + path.join(process.cwd(), "frontend", "orbit-control", "lib", "runtime", "ui-runtime-service.mjs"));
  runtime.uiRuntimeService.reset();
  const created = runtime.uiRuntimeService.createRuntimeRun({ summary: "L2 trace test" });
  const found = runtime.uiRuntimeService.getRunTrace(created.runId);
  assert.equal(found.runId, created.runId);
  assert.equal(found.summary, "L2 trace test");
});
