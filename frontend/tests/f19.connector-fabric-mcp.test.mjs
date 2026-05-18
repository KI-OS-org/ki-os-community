import test from 'node:test';
import assert from 'node:assert/strict';
import { connectorRegistry, connectorDetail, connectorCapabilityResolver, mcpManifestPreview, fileFabricSummary, testInvoke } from '../lib/adapters/connector-fabric.ts';

test('registry exposes usable connectors', () => {
  const items = connectorRegistry();
  assert.ok(items.length >= 4);
  assert.equal(items.some((i) => i.category === 'MCP'), true);
});

test('mcp manifest and capability resolver are readable', () => {
  const manifest = mcpManifestPreview();
  const caps = connectorCapabilityResolver();
  assert.equal(manifest.server, 'ki-os-mcp-gateway');
  assert.equal(caps.some((i) => i.capabilities.includes('invoke')), true);
});

test('detail, test invoke and file fabric are available', () => {
  const detail = connectorDetail('mcp-generic');
  const invoke = testInvoke('mcp-generic');
  const fabric = fileFabricSummary();
  assert.equal(detail.trustLevel, 'sandboxed');
  assert.equal(invoke.ok, true);
  assert.ok(fabric.totalItems > 0);
});
