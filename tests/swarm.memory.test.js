/**
 * @file    swarm.memory.test.js
 * @desc    Unit Tests für swarm.memory.js — store, retrieve, feedback, Score-Gate, Decay.
 *          Nutzt node:test built-in runner, kein Jest/Mocha.
 *          Isoliert via SWARM_MEMORY_PATH + require-cache-reset zwischen Tests.
 * @author  Ingo Schaffer <ingo@ki-os.org>
 * @coauthor Kimba <kimba@ki-os.org>
 * @license AGPL-3.0-only — https://www.gnu.org/licenses/agpl-3.0.html
 */

'use strict';

const test   = require('node:test');
const assert = require('node:assert');
const path   = require('node:path');
const os     = require('node:os');
const fs     = require('node:fs');

const SWARM_MODULE = path.resolve(__dirname, '../backend/services/memory/swarm.memory.js');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function freshStore() {
  // Setze env + invalidiere require-cache damit _cache zurückgesetzt wird
  const tmpPath = path.join(os.tmpdir(), `swarm-test-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
  process.env.SWARM_MEMORY_PATH = tmpPath;
  delete require.cache[SWARM_MODULE];
  return { swarm: require(SWARM_MODULE), tmpPath };
}

function cleanup(tmpPath) {
  try { if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath); } catch {}
  try {
    const dir = path.dirname(tmpPath);
    if (fs.existsSync(dir) && dir !== os.tmpdir()) fs.rmdirSync(dir);
  } catch {}
}

// ─── Tests ────────────────────────────────────────────────────────────────────

test('store() — leerer Text wirft Error', () => {
  const { swarm, tmpPath } = freshStore();
  try {
    assert.throws(() => swarm.store(''), /darf nicht leer/i);
    assert.throws(() => swarm.store(null), /darf nicht leer/i);
  } finally { cleanup(tmpPath); }
});

test('store() — neuer Eintrag wird korrekt angelegt', () => {
  const { swarm, tmpPath } = freshStore();
  try {
    const result = swarm.store('Unit test pattern für Cache', { type: 'pattern', author: 'test' });
    assert.ok(result.id, 'id muss gesetzt sein');
    assert.strictEqual(result.created, true);

    const stats = swarm.getStats();
    assert.strictEqual(stats.total, 1);
  } finally { cleanup(tmpPath); }
});

test('store() — gleicher Text = update (Deduplizierung)', () => {
  const { swarm, tmpPath } = freshStore();
  try {
    const text = 'Gemeinsamer Test-Text für Deduplizierung';
    const first  = swarm.store(text, { type: 'pattern' });
    const second = swarm.store(text, { type: 'pattern' });

    assert.strictEqual(first.id, second.id, 'IDs müssen gleich sein');
    assert.strictEqual(second.updated, true);
    assert.strictEqual(swarm.getStats().total, 1, 'Nur 1 Eintrag trotz 2x store');
  } finally { cleanup(tmpPath); }
});

test('retrieve() — leere query → leeres Array', () => {
  const { swarm, tmpPath } = freshStore();
  try {
    swarm.store('Test Eintrag', { type: 'pattern' });
    const results = swarm.retrieve('');
    assert.deepStrictEqual(results, []);
  } finally { cleanup(tmpPath); }
});

test('retrieve() — findet Eintrag per Keyword-Match', () => {
  const { swarm, tmpPath } = freshStore();
  try {
    swarm.store('Agent Erstellung mit Factory Pattern', { type: 'pattern' });
    swarm.store('Völlig anderes Thema über Datenbanken', { type: 'pattern' });

    const results = swarm.retrieve('Agent Factory');
    assert.ok(results.length >= 1, 'Mindestens ein Treffer erwartet');
    assert.ok(results[0].text.toLowerCase().includes('agent'), 'Bester Treffer enthält Keyword');
  } finally { cleanup(tmpPath); }
});

test('retrieve() — gibt maximal k Ergebnisse zurück', () => {
  const { swarm, tmpPath } = freshStore();
  try {
    for (let i = 0; i < 10; i++) {
      swarm.store(`Cache Pattern Test Nummer ${i} agent`, { type: 'pattern' });
    }
    const results = swarm.retrieve('Cache Pattern agent', 3);
    assert.ok(results.length <= 3, `Max k=3 aber ${results.length} zurückgegeben`);
  } finally { cleanup(tmpPath); }
});

test('retrieveAsContext() — leerer String wenn keine Treffer', () => {
  const { swarm, tmpPath } = freshStore();
  try {
    const ctx = swarm.retrieveAsContext('völlig unbekannter Begriff xyz123');
    assert.strictEqual(ctx, '');
  } finally { cleanup(tmpPath); }
});

test('retrieveAsContext() — gibt formatierten String zurück', () => {
  const { swarm, tmpPath } = freshStore();
  try {
    swarm.store('Agent Pattern für Context Test', { type: 'pattern' });
    const ctx = swarm.retrieveAsContext('Agent Pattern');
    assert.ok(ctx.includes('SWARM-KONTEXT'), 'Muss SWARM-KONTEXT enthalten');
    assert.ok(ctx.includes('[PATTERN]'), 'Muss Typ-Tag enthalten');
    assert.ok(ctx.includes('conf:'), 'Muss Confidence enthalten');
  } finally { cleanup(tmpPath); }
});

test('feedback() — positive: confidence erhöht sich', () => {
  const { swarm, tmpPath } = freshStore();
  try {
    const { id } = swarm.store('Feedback Boost Test', { type: 'pattern' });
    const before = swarm.retrieve('Feedback Boost')[0]?.effectiveConfidence || 0.70;

    swarm.feedback(id, true);
    const after = swarm.retrieve('Feedback Boost')[0]?.effectiveConfidence;
    assert.ok(after > before, `Confidence muss gestiegen sein: ${before} → ${after}`);
  } finally { cleanup(tmpPath); }
});

test('feedback() — negative: confidence sinkt', () => {
  const { swarm, tmpPath } = freshStore();
  try {
    const { id } = swarm.store('Feedback Penalty Test', { type: 'pattern' });
    swarm.feedback(id, false);
    const result = swarm.retrieve('Feedback Penalty')[0];
    assert.ok(result.effectiveConfidence < 0.70, 'Confidence muss gesunken sein');
  } finally { cleanup(tmpPath); }
});

test('feedback() — unbekannte ID: { found: false }', () => {
  const { swarm, tmpPath } = freshStore();
  try {
    const result = swarm.feedback('nichtexistent123', true);
    assert.strictEqual(result.found, false);
  } finally { cleanup(tmpPath); }
});

test('getStats() — gibt total, byType, avgConfidence zurück', () => {
  const { swarm, tmpPath } = freshStore();
  try {
    swarm.store('Pattern A', { type: 'pattern' });
    swarm.store('Antipattern X', { type: 'antipattern' });

    const stats = swarm.getStats();
    assert.strictEqual(stats.total, 2);
    assert.ok(stats.byType.pattern >= 1);
    assert.ok(stats.byType.antipattern >= 1);
    assert.ok(typeof stats.avgConfidence === 'number');
  } finally { cleanup(tmpPath); }
});
