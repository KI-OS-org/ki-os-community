/**
 * KI-OS — (C) 2026 Ingo Schaffer
 * https://ki-os.org
 */
process.env.NODE_ENV = 'test';
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const tempFile = path.join(os.tmpdir(), `ki-os-r13-memory-${Date.now()}.json`);
process.env.MEMORY_DRIVER = 'file';
process.env.LOCAL_MEMORY_FILE = tempFile;

const { createApp } = require('../core/app');
const Observability = require('../backend/services/core/observability.service');
const runtimeStore = require('../backend/services/ui/runtime.store');
const semantic = require('../backend/services/memory/semantic-memory.service');

const adminHeaders = { 'x-user-id': 'qa-admin', 'x-role': 'admin' };

test.beforeEach(() => {
  Observability.reset();
  runtimeStore.resetStore();
  try { fs.unlinkSync(tempFile); } catch {}
});

test.after(() => {
  try { fs.unlinkSync(tempFile); } catch {}
});

test('semantic memory v2 resolves lowercase entities and project names', () => {
  const item = semantic.annotateItem({
    userId: 'max',
    timestamp: '2026-03-18T10:00:00Z',
    category: 'profile',
    text: 'max arbeitet bei rewe digital. das projekt heisst ki-os und laeuft seit januar.'
  });
  const entityValues = item.semantic.entities.map((entity) => `${entity.type}:${entity.value}`.toLowerCase());
  assert.ok(entityValues.some((entry) => entry.includes('person:max')));
  assert.ok(entityValues.some((entry) => entry.includes('company:rewe digital')));
  assert.ok(entityValues.some((entry) => entry.includes('project:ki-os')));
  assert.ok(item.semantic.resolvedEntities.length >= 3);
});

test('semantic memory v2 marks conflicts and explainable retrieval includes provenance and confidence', async () => {
  const app = createApp();
  await app.handleHttp({
    runtime: 'test', path: '/memory', method: 'POST', headers: adminHeaders,
    body: { userId: 'ingo', category: 'profile', text: 'Ich arbeite bei REWE Digital in Köln.', metadata: { traceId: 't1' } }
  });
  await app.handleHttp({
    runtime: 'test', path: '/memory', method: 'POST', headers: adminHeaders,
    body: { userId: 'ingo', category: 'profile', text: 'Ich arbeite bei MediaMarkt in München und arbeite bei Saturn in Berlin.', metadata: { traceId: 't2' } }
  });
  const res = await app.handleHttp({
    runtime: 'test', path: '/memory/retrieve', method: 'POST', headers: adminHeaders,
    body: { userId: 'ingo', query: '', limit: 5 }
  });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.version, 'v2');
  assert.ok(res.body.items.length >= 1);
  assert.ok(Array.isArray(res.body.items[0].retrievalExplanation));
  assert.ok(typeof res.body.items[0].retrievalConfidence === 'number');
  assert.ok(res.body.items[0].provenance.sourceId);
  const schemaConflicts = res.body.schema.conflicts || [];
  assert.ok(schemaConflicts.length >= 1);
  const snapshot = Observability.getSnapshot();
  assert.ok(snapshot.observability.eventsByType['memory.conflict.detected'] >= 1);
});

test('memory graph endpoints expose graph runtime and explainable structure', async () => {
  const app = createApp();
  await app.handleHttp({
    runtime: 'test', path: '/memory', method: 'POST', headers: adminHeaders,
    body: {
      userId: 'ingo', category: 'outcome',
      text: 'Working at Retail GmbH, tracking revenue and margin.',
      metadata: { expectedOutcomeKey: 'revenue', observedOutcomeKey: 'margin', outcomeConfidence: 0.91 }
    }
  });
  const graph = await app.handleHttp({ runtime: 'test', path: '/memory/graph', method: 'GET', headers: adminHeaders, query: { userId: 'ingo', graph: 'true' } });
  assert.equal(graph.statusCode, 200);
  assert.equal(graph.body.success, true);
  assert.equal(graph.body.graph.version, 'v1');
  assert.ok(graph.body.graph.stats.nodeCount >= 1);

  const ui = await app.handleHttp({ runtime: 'test', path: '/ui/memory/graph', method: 'GET', headers: adminHeaders, query: { userId: 'ingo', limit: '10' } });
  assert.equal(ui.statusCode, 200);
  assert.equal(ui.body.success, true);
  assert.ok(Array.isArray(ui.body.graph.nodes));
});
