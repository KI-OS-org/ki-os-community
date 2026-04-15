/**
 * @file    qwen.builder.test.js
 * @desc    Unit Tests für qwen.builder.agent.js — build(), review(), Score-Gate Logik.
 *          Score-Gate wird als isolierte Pure-Function getestet (kein Netzwerk nötig).
 *          Fehler-Pfade für build()/review() testen ohne API-Calls.
 * @author  Ingo Schaffer <ingo@ki-os.org>
 * @coauthor Kimba <kimba@ki-os.org>
 * @license AGPL-3.0-only — https://www.gnu.org/licenses/agpl-3.0.html
 */

'use strict';

const test   = require('node:test');
const assert = require('node:assert');
const path   = require('node:path');
const os     = require('node:os');

// ─── Score-Gate Logik (isoliert testbar) ──────────────────────────────────────
// Spiegelt exakt die Logik in qwen.builder.agent.js review() wider.
// Wenn die Logik dort geändert wird, muss sie hier synchron gehalten werden.

function applyScoreGate(result, memory, task) {
  if (result.approved && result.score >= 0.90) {
    memory.store(`Task approved (score ${result.score}): ${(task || '').slice(0, 120)}`, {
      type: 'pattern', author: 'deepseek'
    });
  } else if (!result.approved && result.score <= 0.65) {
    for (const issue of (result.issues || [])) {
      memory.store(issue, { type: 'antipattern', found_by: 'deepseek' });
    }
  }
  // Grauzone: 0.66–0.89 approved oder >0.65 not-approved → nichts schreiben
}

// ─── build() Fehler-Pfade ─────────────────────────────────────────────────────

test('build() — leerer task → success: false', async () => {
  // Setze ungültige API-Keys damit kein echter Netzwerk-Call passiert
  const orig = process.env.OPENROUTER_API_KEY;
  delete process.env.OPENROUTER_API_KEY;

  const modulePath = path.resolve(__dirname, '../backend/services/agent/qwen.builder.agent.js');
  delete require.cache[modulePath];

  try {
    const { build } = require(modulePath);
    const result = await build('');
    assert.strictEqual(result.success, false);
    assert.ok(result.error, 'error-Feld muss gesetzt sein');
  } finally {
    if (orig) process.env.OPENROUTER_API_KEY = orig;
    delete require.cache[modulePath];
  }
});

test('build() — null task → success: false', async () => {
  const orig = process.env.OPENROUTER_API_KEY;
  delete process.env.OPENROUTER_API_KEY;

  const modulePath = path.resolve(__dirname, '../backend/services/agent/qwen.builder.agent.js');
  delete require.cache[modulePath];

  try {
    const { build } = require(modulePath);
    const result = await build(null);
    assert.strictEqual(result.success, false);
  } finally {
    if (orig) process.env.OPENROUTER_API_KEY = orig;
    delete require.cache[modulePath];
  }
});

test('review() — leerer code → approved: false', async () => {
  const orig = process.env.OPENROUTER_API_KEY;
  delete process.env.OPENROUTER_API_KEY;

  const modulePath = path.resolve(__dirname, '../backend/services/agent/qwen.builder.agent.js');
  delete require.cache[modulePath];

  try {
    const { review } = require(modulePath);
    const result = await review('', 'some task');
    assert.strictEqual(result.approved, false);
  } finally {
    if (orig) process.env.OPENROUTER_API_KEY = orig;
    delete require.cache[modulePath];
  }
});

// ─── Score-Gate Tests ─────────────────────────────────────────────────────────

test('Score-Gate — score=0.95 approved → Pattern wird gespeichert', () => {
  const stored = [];
  const mockMemory = { store: (text, meta) => stored.push({ text, meta }) };

  applyScoreGate({ approved: true, score: 0.95, issues: [] }, mockMemory, 'test task');

  assert.strictEqual(stored.length, 1, 'Genau 1 Eintrag erwartet');
  assert.strictEqual(stored[0].meta.type, 'pattern');
  assert.ok(stored[0].text.includes('0.95'));
});

test('Score-Gate — score=0.90 approved → Pattern wird gespeichert (Grenze)', () => {
  const stored = [];
  const mockMemory = { store: (text, meta) => stored.push({ text, meta }) };

  applyScoreGate({ approved: true, score: 0.90, issues: [] }, mockMemory, 'test task');

  assert.strictEqual(stored.length, 1);
  assert.strictEqual(stored[0].meta.type, 'pattern');
});

test('Score-Gate — score=0.85 approved → NICHTS gespeichert (Grauzone)', () => {
  const stored = [];
  const mockMemory = { store: (text, meta) => stored.push({ text, meta }) };

  applyScoreGate({ approved: true, score: 0.85, issues: [] }, mockMemory, 'test task');

  assert.strictEqual(stored.length, 0, 'Grauzone: nichts ins Memory');
});

test('Score-Gate — score=0.60 not approved → Antipattern gespeichert', () => {
  const stored = [];
  const mockMemory = { store: (text, meta) => stored.push({ text, meta }) };

  applyScoreGate(
    { approved: false, score: 0.60, issues: ['Missing error handling', 'SQL injection risk'] },
    mockMemory,
    'test task'
  );

  assert.strictEqual(stored.length, 2, '2 Issues = 2 Antipattern-Einträge');
  assert.ok(stored.every(s => s.meta.type === 'antipattern'));
});

test('Score-Gate — score=0.65 not approved → Antipattern gespeichert (Grenze)', () => {
  const stored = [];
  const mockMemory = { store: (text, meta) => stored.push({ text, meta }) };

  applyScoreGate({ approved: false, score: 0.65, issues: ['One issue'] }, mockMemory, 'test');

  assert.strictEqual(stored.length, 1);
  assert.strictEqual(stored[0].meta.type, 'antipattern');
});

test('Score-Gate — score=0.70 not approved → NICHTS gespeichert (kein Fehlalarm)', () => {
  const stored = [];
  const mockMemory = { store: (text, meta) => stored.push({ text, meta }) };

  applyScoreGate(
    { approved: false, score: 0.70, issues: ['Possible issue'] },
    mockMemory,
    'test task'
  );

  assert.strictEqual(stored.length, 0, 'Über 0.65: kein Antipattern-Fehlalarm');
});

test('Score-Gate — issues leer bei not-approved → kein Crash', () => {
  const stored = [];
  const mockMemory = { store: (text, meta) => stored.push({ text, meta }) };

  assert.doesNotThrow(() => {
    applyScoreGate({ approved: false, score: 0.50, issues: [] }, mockMemory, 'test');
  });
  assert.strictEqual(stored.length, 0);
});
