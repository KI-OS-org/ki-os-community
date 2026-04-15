process.env.NODE_ENV = 'test';
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const tempFile = path.join(os.tmpdir(), `ki-os-r9-memory-${Date.now()}.json`);
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

test('semantic memory annotates entities, relations and provenance', () => {
  const item = semantic.annotateItem({
    userId: 'ingo',
    timestamp: '2026-03-18T10:00:00Z',
    category: 'profile',
    text: 'Mein Name ist Ingo Schaffer und ich arbeite bei REWE Digital in München. KPI Umsatz und Conversion sind wichtig.'
  });
  assert.ok(item.semantic.entities.length >= 3);
  assert.ok(item.semantic.relations.length >= 2);
  assert.equal(item.semantic.provenance.sourceType, 'memory');
});

test('memory controller saves semantic memory and emits mutation events', async () => {
  const app = createApp();
  const save = await app.handleHttp({
    runtime: 'test',
    path: '/memory',
    method: 'POST',
    headers: adminHeaders,
    body: {
      userId: 'ingo',
      category: 'profile',
      text: 'Mein Name ist Ingo Schaffer und ich arbeite bei REWE Digital in München.',
      metadata: { traceId: 'trace-r9-1' }
    }
  });
  assert.equal(save.statusCode, 200);
  assert.equal(save.body.success, true);
  assert.ok(save.body.item.memoryId);
  assert.ok(save.body.item.semantic.entities.length >= 2);

  const snapshot = Observability.getSnapshot();
  assert.ok(snapshot.observability.eventsByType['memory.mutation.saved'] >= 1);
});

test('semantic retrieval returns provenance references and outcome markers', async () => {
  const app = createApp();
  await app.handleHttp({
    runtime: 'test',
    path: '/memory',
    method: 'POST',
    headers: adminHeaders,
    body: {
      userId: 'ingo',
      category: 'outcome',
      text: 'Das Projekt KI-OS verbessert Umsatz und Conversion messbar.',
      metadata: {
        expectedOutcomeKey: 'revenue',
        observedOutcomeKey: 'conversion',
        outcomeConfidence: 0.87,
        signalSource: 'qa-test'
      }
    }
  });
  const res = await app.handleHttp({
    runtime: 'test',
    path: '/memory/retrieve',
    method: 'POST',
    headers: adminHeaders,
    body: { userId: 'ingo', query: 'Conversion', limit: 5 }
  });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.version, 'v2');
  assert.ok(res.body.items.length >= 1);
  assert.ok(res.body.items[0].provenance.sourceId);
  assert.ok((res.body.items[0].semantic.outcomeMarkers || []).length >= 1);

  const snapshot = Observability.getSnapshot();
  assert.ok(snapshot.observability.eventsByType['memory.retrieval.performed'] >= 1);
  assert.ok(snapshot.observability.eventsByType['memory.outcome.marker.created'] >= 1);
});

test('ui memory endpoint exposes schema summary', async () => {
  const app = createApp();
  await app.handleHttp({
    runtime: 'test',
    path: '/memory',
    method: 'POST',
    headers: adminHeaders,
    body: { userId: 'ingo', category: 'project', text: 'Projekt AgentMesh23 stärkt Routing und Governance.' }
  });
  const ui = await app.handleHttp({ runtime: 'test', path: '/ui/memory', method: 'GET', headers: adminHeaders, query: { userId: 'ingo', limit: '10' } });
  assert.equal(ui.statusCode, 200);
  assert.equal(ui.body.success, true);
  assert.ok(Array.isArray(ui.body.schema.entities));
  assert.ok(Array.isArray(ui.body.schema.relations));
});
