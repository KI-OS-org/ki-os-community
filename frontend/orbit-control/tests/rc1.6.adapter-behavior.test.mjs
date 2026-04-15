import test from "node:test";
import assert from "node:assert/strict";

global.fetch = async (url, options = {}) => ({
  ok: true,
  status: 200,
  headers: new Map([["content-type", "application/json"]]),
  json: async () => ({ ok: true, url, method: options.method || "GET" }),
  text: async () => ""
});
global.fetch.prototype = {};

const { getControlPlaneSnapshot } = await import("../lib/adapters/control-plane.ts");
const { getGovernanceRegistry, simulateGovernance } = await import("../lib/adapters/governance-studio.ts");
const { getEconomicDashboard } = await import("../lib/adapters/economic.ts");
const { getFederationDashboard } = await import("../lib/adapters/federation.ts");
const { getRetailOps } = await import("../lib/adapters/retail.ts");
const { startWorkspaceRun } = await import("../lib/adapters/workspace.ts");
const { getMissionControlVisible } = await import("../lib/adapters/mission-control.ts");

test("control-plane adapter returns object", async () => {
  const data = await getControlPlaneSnapshot();
  assert.equal(typeof data, "object");
});

test("governance adapter registry and simulate return objects", async () => {
  const reg = await getGovernanceRegistry();
  assert.equal(typeof reg, "object");
  const sim = await simulateGovernance({ provider: "openai", model: "gpt-4o-mini", input: "hi" });
  assert.equal(typeof sim, "object");
});

test("economic, federation, retail, workspace, mission-control adapters call through", async () => {
  assert.equal(typeof await getEconomicDashboard(), "object");
  assert.equal(typeof await getFederationDashboard(), "object");
  assert.equal(typeof await getRetailOps(), "object");
  assert.equal(typeof await startWorkspaceRun({ text: "hello" }), "object");
  assert.equal(typeof await getMissionControlVisible(), "object");
});
