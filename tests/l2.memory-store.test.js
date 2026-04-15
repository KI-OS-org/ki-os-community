/**
 * KI-OS — (C) 2026 Ingo Schaffer
 * https://ki-os.org
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

test("L2 memory store retrieves created memory hits by query and tenant", async () => {
  const runtime = await import("file://" + path.join(process.cwd(), "frontend", "orbit-control", "lib", "runtime", "ui-runtime-service.mjs"));
  runtime.uiRuntimeService.reset();
  runtime.uiRuntimeService.createRuntimeRun({
    tenant: "demo-tenant",
    sourceName: "Promo Analysis",
    summary: "Promotion margin needs review",
    tags: ["promotion", "margin"]
  });
  const hits = runtime.uiRuntimeService.retrieveMemory("promotion", "demo-tenant", "");
  assert.equal(hits.length >= 1, true);
  assert.equal(hits.some((item) => item.summary.includes("Promotion")), true);
});
