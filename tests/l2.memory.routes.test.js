/**
 * KI-OS — (C) 2026 Ingo Schaffer
 * https://ki-os.org
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("L2 memory route exists and retrieval returns saved hits", async () => {
  const routePath = path.join(process.cwd(), "frontend", "orbit-control", "app", "api", "memory", "retrieve", "route.ts");
  assert.equal(fs.existsSync(routePath), true);
  const runtime = await import("file://" + path.join(process.cwd(), "frontend", "orbit-control", "lib", "runtime", "ui-runtime-service.mjs"));
  runtime.uiRuntimeService.reset();
  runtime.uiRuntimeService.createRuntimeRun({ summary: "Margin alert for retail", tags: ["margin", "retail"] });
  const hits = runtime.uiRuntimeService.retrieveMemory("margin", "", "");
  assert.equal(hits.length >= 1, true);
});
