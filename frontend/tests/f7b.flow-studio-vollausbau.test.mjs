import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const base = path.resolve(process.cwd(), "frontend/orbit-control");

function read(rel) {
  return fs.readFileSync(path.join(base, rel), "utf8");
}

test("F7b includes 10 node types and 8 flow templates", () => {
  const source = read("components/flows/flow-types.ts");
  const nodeTypes = [...source.matchAll(/type: "([a-zA-Z]+)"/g)].map((m) => m[1]);
  assert.equal(new Set(nodeTypes).size, 10);
  const templateCount = (source.match(/id: "/g) || []).length;
  assert.ok(templateCount >= 8);
});

test("F7b ships test-run and governance preview scaffolding", () => {
  const shell = read("components/flows/flow-studio-shell.tsx");
  assert.match(shell, /GovernancePreviewPanel/);
  assert.match(shell, /FlowTestRunPanel/);
});

test("F7b test route returns node-results through adapter", () => {
  const route = read("app/api/flows/test-run/route.ts");
  const adapter = read("lib/adapters/flow-studio.ts");
  assert.match(route, /runFlowNodeTest/);
  assert.match(adapter, /nodeResults/);
});
