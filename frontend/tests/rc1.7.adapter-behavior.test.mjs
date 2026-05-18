import test from "node:test";
import assert from "node:assert/strict";

global.fetch = async (url, options = {}) => ({
  ok: true,
  status: 200,
  headers: { get: () => "application/json" },
  json: async () => ({ ok: true, url, method: options.method || "GET" }),
  text: async () => ""
});

const explain = await import("../lib/adapters/explain-trust.ts");
const filesMemory = await import("../lib/adapters/files-memory.ts");
const integrations = await import("../lib/adapters/integrations.ts");
const templates = await import("../lib/adapters/templates.ts");
const solutions = await import("../lib/adapters/solutions.ts");
const tenant = await import("../lib/adapters/tenant.ts");
const webhooks = await import("../lib/adapters/webhooks.ts");
const connectors = await import("../lib/adapters/connector-fabric.ts");
const flow = await import("../lib/adapters/flow-studio.ts");
const packs = await import("../lib/adapters/packs.ts");
const whiteboard = await import("../lib/adapters/whiteboard.ts");

test("explain and trust adapters return objects", async () => {
  assert.equal(typeof await explain.explainAdapter.getExplainSnapshot(), "object");
  assert.equal(typeof await explain.explainAdapter.getTrustLens(), "object");
});

test("files-memory and integrations adapters return objects", async () => {
  assert.equal(typeof await filesMemory.getFilesSnapshot(), "object");
  assert.equal(typeof await integrations.getIntegrationsHubSnapshot(), "object");
});

test("templates, solutions, tenant, webhooks adapters return objects", async () => {
  assert.equal(typeof await templates.listTemplates(), "object");
  assert.equal(typeof await solutions.getVisibleSolutions(), "object");
  assert.equal(typeof await tenant.tenantAdapter.listTenants(), "object");
  assert.equal(typeof await webhooks.getWebhookStudioData(), "object");
});

test("connector, flow, packs, whiteboard adapters return objects", async () => {
  assert.equal(typeof await connectors.connectorRegistry(), "object");
  assert.equal(typeof await flow.getFlowTemplates(), "object");
  assert.equal(typeof await packs.packsAdapter.listPacks(), "object");
  assert.equal(typeof await whiteboard.getWhiteboardState(), "object");
});
