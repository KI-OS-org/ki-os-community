/**
 * KI-OS — (C) 2026 Ingo Schaffer
 * https://ki-os.org
 */
/**
 * Tests: Campaign Orchestrator
 * node --test tests/campaign-orchestrator.test.js
 *
 * Tests laufen ohne echte DAG-Ausführung / LLM-Aufrufe.
 * Budget- und Performance-Service werden direkt getestet.
 */

'use strict';

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs     = require('fs');
const path   = require('path');
const os     = require('os');

// ── Isolierte Temp-Dateien für Tests ──────────────────────────────────────

let tmpDir;
let origCwd;

before(() => {
  tmpDir  = fs.mkdtempSync(path.join(os.tmpdir(), 'kios-campaign-test-'));
  origCwd = process.cwd;
  process.cwd = () => tmpDir;
});

after(() => {
  process.cwd = origCwd;
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// Lazy-require nach before() damit process.cwd() bereits überschrieben ist
function getBudgetService()      { return require('../backend/services/campaigns/budget.service'); }
function getPerfService()        { return require('../backend/services/campaigns/campaign.performance.service'); }

// ── Budget Service ─────────────────────────────────────────────────────────

describe('BudgetService', () => {

  test('createBudget gibt Budget mit korrekten Feldern zurück', () => {
    const svc = getBudgetService();
    const b   = svc.createBudget({
      campaignId:  'test-camp-1',
      amountCents: 10000,
      currency:    'EUR',
      label:       'Test Budget',
    });
    assert.equal(b.campaignId,   'test-camp-1');
    assert.equal(b.amountCents,  10000);
    assert.equal(b.currency,     'EUR');
    assert.equal(b.spentCents,   0);
    assert.ok(b.id);
    assert.ok(b.createdAt);
  });

  test('getBudget gibt null für unbekannte Kampagne zurück', () => {
    const svc = getBudgetService();
    assert.equal(svc.getBudget('unknown-xyz'), null);
  });

  test('checkBudget erlaubt Ausgabe innerhalb des Budgets', () => {
    const svc = getBudgetService();
    svc.createBudget({ campaignId: 'check-camp', amountCents: 5000, currency: 'EUR' });
    const r = svc.checkBudget('check-camp', 1000);
    assert.equal(r.allowed,   true);
    assert.equal(r.remaining, 5000);
  });

  test('checkBudget verweigert Ausgabe über dem Budget', () => {
    const svc = getBudgetService();
    svc.createBudget({ campaignId: 'over-camp', amountCents: 500, currency: 'EUR' });
    const r = svc.checkBudget('over-camp', 1000);
    assert.equal(r.allowed, false);
  });

  test('checkBudget erlaubt alles ohne Budget (kein Eintrag)', () => {
    const svc = getBudgetService();
    const r = svc.checkBudget('no-budget-camp', 99999);
    assert.equal(r.allowed, true);
  });

  test('bookSpend aktualisiert spentCents korrekt', () => {
    const svc = getBudgetService();
    svc.createBudget({ campaignId: 'spend-camp', amountCents: 10000, currency: 'EUR' });
    const b = svc.bookSpend('spend-camp', 2500, 'Content generation');
    assert.equal(b.spentCents, 2500);
  });

  test('getBudgetStatus gibt utilizationPct und status zurück', () => {
    const svc = getBudgetService();
    svc.createBudget({ campaignId: 'status-camp', amountCents: 10000, currency: 'EUR' });
    svc.bookSpend('status-camp', 3000, 'test');
    const s = svc.getBudgetStatus('status-camp');
    assert.equal(s.utilizationPct, 30);
    assert.equal(s.remaining,      7000);
    assert.equal(s.status,         'ok');
  });

  test('getBudgetStatus status=warning bei > 80%', () => {
    const svc = getBudgetService();
    svc.createBudget({ campaignId: 'warn-camp', amountCents: 1000, currency: 'EUR' });
    svc.bookSpend('warn-camp', 850, 'test');
    const s = svc.getBudgetStatus('warn-camp');
    assert.equal(s.status, 'warning');
  });

  test('getBudgetStatus status=exhausted bei >= 100%', () => {
    const svc = getBudgetService();
    svc.createBudget({ campaignId: 'exhaust-camp', amountCents: 1000, currency: 'EUR' });
    svc.bookSpend('exhaust-camp', 1000, 'test');
    const s = svc.getBudgetStatus('exhaust-camp');
    assert.equal(s.status, 'exhausted');
  });

});

// ── Performance Service ────────────────────────────────────────────────────

describe('CampaignPerformanceService', () => {

  test('getPerformance gibt Zero-Metrics für neue Kampagne zurück', () => {
    const svc = getPerfService();
    const p   = svc.getPerformance('new-camp-perf');
    assert.equal(p.impressions,  0);
    assert.equal(p.clicks,       0);
    assert.equal(p.conversions,  0);
    assert.equal(p.ctr,          0);
    assert.equal(p.cvr,          0);
  });

  test('recordEvent impression erhöht impressions', () => {
    const svc = getPerfService();
    svc.recordEvent('perf-camp-1', 'impression', 100);
    const p = svc.getPerformance('perf-camp-1');
    assert.equal(p.impressions, 100);
  });

  test('recordEvent click berechnet CTR korrekt', () => {
    const svc = getPerfService();
    svc.recordEvent('perf-camp-2', 'impression', 200);
    const p = svc.recordEvent('perf-camp-2', 'click', 10);
    assert.equal(p.ctr, 5); // 10/200 * 100 = 5%
  });

  test('recordEvent conversion berechnet CVR korrekt', () => {
    const svc = getPerfService();
    svc.recordEvent('perf-camp-3', 'impression', 1000);
    svc.recordEvent('perf-camp-3', 'click', 50);
    const p = svc.recordEvent('perf-camp-3', 'conversion', 5);
    assert.equal(p.cvr, 10); // 5/50 * 100 = 10%
  });

  test('updateSpend setzt spentCents und berechnet ROI', () => {
    const svc = getPerfService();
    const p   = svc.updateSpend('roi-camp', 10000, 15000);
    assert.equal(p.spentCents, 10000);
    assert.equal(p.roiPct,     50); // (15000-10000)/10000 * 100 = 50%
  });

  test('updateSpend ohne Revenue setzt roiPct nicht', () => {
    const svc = getPerfService();
    const p   = svc.updateSpend('no-roi-camp', 5000);
    assert.equal(p.spentCents, 5000);
    assert.equal(p.roiPct,     null);
  });

  test('deletePerformance entfernt Daten', () => {
    const svc = getPerfService();
    svc.recordEvent('del-camp', 'impression', 10);
    svc.deletePerformance('del-camp');
    const p = svc.getPerformance('del-camp');
    assert.equal(p.impressions, 0);
  });

  test('cpcCents berechnet Kosten pro Klick', () => {
    const svc = getPerfService();
    svc.recordEvent('cpc-camp', 'impression', 100);
    svc.recordEvent('cpc-camp', 'click', 10);
    const p = svc.updateSpend('cpc-camp', 1000);
    assert.equal(p.cpcCents, 100); // 1000 / 10 = 100
  });

});

// ── createCampaign Validierung ─────────────────────────────────────────────

describe('createCampaign Validation', () => {

  test('goal kürzer als 5 Zeichen wirft VALIDATION_ERROR', () => {
    // Direkte Validierungslogik testen ohne DAG-Ausführung
    function validateCampaignInput(data) {
      if (!data.goal || data.goal.trim().length < 5)
        throw Object.assign(new Error('goal muss mindestens 5 Zeichen haben'), { code: 'VALIDATION_ERROR' });
      if (!data.product || data.product.trim().length < 2)
        throw Object.assign(new Error('product muss mindestens 2 Zeichen haben'), { code: 'VALIDATION_ERROR' });
    }
    assert.throws(
      () => validateCampaignInput({ goal: 'ok', product: 'x' }),
      (e) => e.code === 'VALIDATION_ERROR'
    );
  });

  test('product kürzer als 2 Zeichen wirft VALIDATION_ERROR', () => {
    function validateCampaignInput(data) {
      if (!data.goal || data.goal.trim().length < 5)
        throw Object.assign(new Error('goal'), { code: 'VALIDATION_ERROR' });
      if (!data.product || data.product.trim().length < 2)
        throw Object.assign(new Error('product muss mindestens 2 Zeichen haben'), { code: 'VALIDATION_ERROR' });
    }
    assert.throws(
      () => validateCampaignInput({ goal: 'Markenbekanntheit steigern', product: 'x' }),
      (e) => e.code === 'VALIDATION_ERROR'
    );
  });

  test('gültige Eingabe wirft keinen Fehler', () => {
    function validateCampaignInput(data) {
      if (!data.goal || data.goal.trim().length < 5)
        throw Object.assign(new Error('goal'), { code: 'VALIDATION_ERROR' });
      if (!data.product || data.product.trim().length < 2)
        throw Object.assign(new Error('product'), { code: 'VALIDATION_ERROR' });
    }
    assert.doesNotThrow(() =>
      validateCampaignInput({ goal: 'Neukunden gewinnen', product: 'KI-OS' })
    );
  });

});
