import test from "node:test";
import assert from "node:assert/strict";

const calls = [];
global.fetch = async (url, options = {}) => {
  calls.push({ url: String(url), method: options.method || "GET" });
  return {
    ok: true,
    status: 200,
    headers: { get: () => "application/json" },
    json: async () => ({ ok: true, url: String(url), method: options.method || "GET" }),
    text: async () => ""
  };
};

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

test("RC1.8 adapter calls hit expected URLs", async () => {
  calls.length = 0;

  await explain.explainAdapter.getExplainSnapshot();
  await explain.explainAdapter.getTrustLens();
  await filesMemory.getFilesSnapshot();
  await integrations.getIntegrationsHubSnapshot();
  await templates.listTemplates();
  await solutions.getVisibleSolutions();
  await tenant.tenantAdapter.listTenants();
  await webhooks.getWebhookStudioData();
  await connectors.connectorRegistry();
  await flow.getFlowTemplates();
  await packs.packsAdapter.listPacks();
  await whiteboard.getWhiteboardState();

  const urls = calls.map((x) => x.url).join("\n");
  assert.match(urls, /\/api\/explain/);
  assert.match(urls, /\/api\/trust/);
  assert.match(urls, /\/api\/files/);
  assert.match(urls, /\/api\/memory\/retrieve/);
  assert.match(urls, /\/api\/integrations\/catalog/);
  assert.match(urls, /\/api\/templates\/list/);
  assert.match(urls, /\/api\/solutions\/domains/);
  assert.match(urls, /\/api\/tenants\/overview/);
  assert.match(urls, /\/api\/webhooks\/generator/);
  assert.match(urls, /\/api\/connectors\/registry/);
  assert.match(urls, /\/api\/flows\/templates/);
  assert.match(urls, /\/api\/packs\/registry/);
  assert.match(urls, /\/api\/whiteboard\/board/);
});
