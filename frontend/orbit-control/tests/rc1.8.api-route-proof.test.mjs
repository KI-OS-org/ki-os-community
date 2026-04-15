import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "../..");

const routes = [
  "frontend/orbit-control/app/api/explain/route.ts",
  "frontend/orbit-control/app/api/trust/route.ts",
  "frontend/orbit-control/app/api/flows/route.ts",
  "frontend/orbit-control/app/api/flows/templates/route.ts",
  "frontend/orbit-control/app/api/flows/test-run/route.ts",
  "frontend/orbit-control/app/api/integrations/catalog/route.ts",
  "frontend/orbit-control/app/api/integrations/connections/route.ts",
  "frontend/orbit-control/app/api/integrations/health/route.ts",
  "frontend/orbit-control/app/api/files/route.ts",
  "frontend/orbit-control/app/api/memory/retrieve/route.ts",
  "frontend/orbit-control/app/api/packs/registry/route.ts",
  "frontend/orbit-control/app/api/packs/install/route.ts",
  "frontend/orbit-control/app/api/packs/history/route.ts",
  "frontend/orbit-control/app/api/solutions/domains/route.ts",
  "frontend/orbit-control/app/api/solutions/packs/route.ts",
  "frontend/orbit-control/app/api/templates/list/route.ts",
  "frontend/orbit-control/app/api/templates/start/route.ts",
  "frontend/orbit-control/app/api/tenants/overview/route.ts",
  "frontend/orbit-control/app/api/tenants/detail/route.ts",
  "frontend/orbit-control/app/api/tenants/workspaces/route.ts",
  "frontend/orbit-control/app/api/webhooks/generator/route.ts",
  "frontend/orbit-control/app/api/webhooks/replay/route.ts",
  "frontend/orbit-control/app/api/triggers/catalog/route.ts",
  "frontend/orbit-control/app/api/triggers/preview/route.ts",
  "frontend/orbit-control/app/api/connectors/registry/route.ts",
  "frontend/orbit-control/app/api/connectors/detail/route.ts",
  "frontend/orbit-control/app/api/connectors/test-invoke/route.ts",
  "frontend/orbit-control/app/api/mcp/manifest/route.ts",
  "frontend/orbit-control/app/api/mcp/capabilities/route.ts",
  "frontend/orbit-control/app/api/file-fabric/route.ts",
  "frontend/orbit-control/app/api/whiteboard/board/route.ts",
  "frontend/orbit-control/app/api/whiteboard/shared/route.ts"
];

test("RC1.8 all expected Next API route files exist", async () => {
  for (const file of routes) {
    assert.equal(fs.existsSync(path.join(root, file)), true, file);
  }
});
