/**
 * KI-OS — (C) 2026 Ingo Schaffer
 * https://ki-os.org
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

test("L2 files store returns created file entries for tenant", async () => {
  const runtime = await import("file://" + path.join(process.cwd(), "frontend", "orbit-control", "lib", "runtime", "ui-runtime-service.mjs"));
  runtime.uiRuntimeService.reset();
  const created = runtime.uiRuntimeService.createRuntimeRun({
    tenant: "ops-tenant",
    fileName: "ops-report.md"
  });
  const files = runtime.uiRuntimeService.listFiles("ops-tenant");
  assert.equal(files.some((entry) => entry.fileId === created.fileId), true);
});
