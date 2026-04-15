/**
 * Tests: Swarm Memory API — swarm.controller.js
 * Runner: node --test tests/swarm-memory-api.test.js
 */

'use strict';

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path   = require('path');
const fs     = require('fs');
const os     = require('os');

// ─── Temp-Pfad damit Tests nicht den echten Store überschreiben ───────────────
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ki-os-swarm-test-'));
process.env.SWARM_MEMORY_PATH = path.join(tmpDir, 'store.json');

const { handleSwarm } = require('../backend/services/memory/swarm.controller');

// ─── Cleanup ──────────────────────────────────────────────────────────────────
after(() => {
  try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
});

// ─── Helpers ─────────────────────────────────────────────────────────────────
const post = (p, body) => handleSwarm(p, 'POST', body);
const get  = (p, q={})  => handleSwarm(p, 'GET',  q);
const del  = (p)         => handleSwarm(p, 'DELETE');

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('POST /swarm/store', () => {
  test('speichert neuen Eintrag', async () => {
    const r = await post('/swarm/store', { text: 'LanceDB ist ein Vektorspeicher', metadata: { type: 'pattern' } });
    assert.ok(r.id, 'id vorhanden');
    assert.ok(r.created, 'created=true');
  });

  test('dedupliziert gleichen Text', async () => {
    const r1 = await post('/swarm/store', { text: 'Duplikat-Test' });
    const r2 = await post('/swarm/store', { text: 'Duplikat-Test' });
    assert.equal(r1.id, r2.id, 'gleiche ID bei gleichem Text');
    assert.ok(r2.updated, 'updated=true beim zweiten Call');
  });

  test('400 bei leerem text', async () => {
    const r = await post('/swarm/store', { text: '   ' });
    assert.equal(r._status, 400);
  });

  test('400 bei fehlendem text', async () => {
    const r = await post('/swarm/store', {});
    assert.equal(r._status, 400);
  });

  test('kürzt Text > 2000 Zeichen', async () => {
    const longText = 'X'.repeat(2500);
    const r = await post('/swarm/store', { text: longText });
    assert.ok(r.id, 'kein Fehler bei langem Text');
  });
});

describe('POST /swarm/retrieve', () => {
  before(async () => {
    await post('/swarm/store', { text: 'Node.js ist eine JavaScript-Laufzeitumgebung', metadata: { type: 'fact' } });
    await post('/swarm/store', { text: 'KI-OS nutzt Swarm Memory für Team-Wissen', metadata: { type: 'pattern' } });
  });

  test('gibt Array zurück', async () => {
    const r = await post('/swarm/retrieve', { query: 'Node.js', k: 3 });
    assert.ok(Array.isArray(r));
  });

  test('400 bei fehlendem query', async () => {
    const r = await post('/swarm/retrieve', { k: 5 });
    assert.equal(r._status, 400);
  });

  test('400 bei leerem query', async () => {
    const r = await post('/swarm/retrieve', { query: '' });
    assert.equal(r._status, 400);
  });
});

describe('POST /swarm/feedback', () => {
  let storedId;

  before(async () => {
    const r = await post('/swarm/store', { text: 'Feedback-Test-Eintrag' });
    storedId = r.id;
  });

  test('positives Feedback erhöht confidence', async () => {
    const r = await post('/swarm/feedback', { id: storedId, positive: true });
    assert.equal(r.found, true);
    assert.ok(r.confidence > 0.70, 'confidence nach Boost > 0.70');
  });

  test('negatives Feedback senkt confidence', async () => {
    const r = await post('/swarm/feedback', { id: storedId, positive: false });
    assert.equal(r.found, true);
    assert.ok(typeof r.confidence === 'number');
  });

  test('not found bei unbekannter id', async () => {
    const r = await post('/swarm/feedback', { id: 'unbekannt_xyz' });
    assert.equal(r.found, false);
  });

  test('400 bei fehlendem id', async () => {
    const r = await post('/swarm/feedback', { positive: true });
    assert.equal(r._status, 400);
  });
});

describe('GET /swarm/stats', () => {
  test('gibt Stats-Objekt zurück', async () => {
    const r = await get('/swarm/stats');
    assert.ok(typeof r.total === 'number');
    assert.ok(typeof r.avgConfidence === 'number');
    assert.ok(r.byType);
    assert.ok(r.maxEntries);
  });
});

describe('GET /swarm/entries', () => {
  test('gibt Array zurück', async () => {
    const r = await get('/swarm/entries', { limit: '10' });
    assert.ok(Array.isArray(r));
  });

  test('type-Filter funktioniert', async () => {
    await post('/swarm/store', { text: 'Typ-Filter-Test', metadata: { type: 'fact' } });
    const r = await get('/swarm/entries', { type: 'fact' });
    assert.ok(Array.isArray(r));
    assert.ok(r.every(e => e.metadata?.type === 'fact'), 'alle Einträge haben type=fact');
  });

  test('limit wird respektiert', async () => {
    const r = await get('/swarm/entries', { limit: '2' });
    assert.ok(r.length <= 2);
  });
});

describe('DELETE /swarm/prune', () => {
  test('gibt removed-Zahl zurück', async () => {
    const r = await del('/swarm/prune');
    assert.ok(typeof r.removed === 'number');
  });
});

describe('Routing-Fehler', () => {
  test('404 bei unbekanntem POST-Pfad', async () => {
    const r = await post('/swarm/unbekannt', {});
    assert.equal(r._status, 404);
  });

  test('405 bei PUT', async () => {
    const r = await handleSwarm('/swarm/store', 'PUT', {});
    assert.equal(r._status, 405);
  });
});
