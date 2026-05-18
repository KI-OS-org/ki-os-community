import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

test("F7a route file exists", () => {
  const routePath = path.join(root, "frontend/orbit-control/app/api/flows/route.ts");
  assert.equal(fs.existsSync(routePath), true);
});

test("F7a provides three starter templates", async () => {
  const adapterPath = path.join(root, "frontend/orbit-control/lib/adapters/flow-studio.ts");
  const source = fs.readFileSync(adapterPath, "utf8");
  assert.match(source, /research-brief/);
  assert.match(source, /retail-decision/);
  assert.match(source, /exec-summary/);
});

test("F7a page renders flow studio shell", () => {
  const pagePath = path.join(root, "frontend/orbit-control/app/flows/page.tsx");
  const source = fs.readFileSync(pagePath, "utf8");
  assert.match(source, /FlowStudioShell/);
});