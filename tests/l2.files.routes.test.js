/**
 * KI-OS — (C) 2026 Ingo Schaffer
 * https://ki-os.org
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("L2 files route exists and created file entries are listed", async () => {
  const routePath = path.join(process.cwd(), "frontend", "orbit-control", "app", "api", "files", "route.ts");
  assert.equal(fs.existsSync(routePath), true);
  const runtime = await import("file://" + path.join(process.cwd(), "frontend", "orbit-control", "lib", "runtime", "ui-runtime-service.mjs"));
  runtime.uiRuntimeService.reset();
  runtime.uiRuntimeService.createRuntimeRun({ fileName: "memory-note.md" });
  const files = runtime.uiRuntimeService.listFiles("");
  assert.equal(files.length >= 2, true);
});
