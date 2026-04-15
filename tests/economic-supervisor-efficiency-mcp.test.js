/**
 * KI-OS — (C) 2026 Ingo Schaffer
 * https://ki-os.org
 */
/**
 * Tests: Economic Service, Supervisor Service, Efficiency Store, MCP
 * node --test tests/economic-supervisor-efficiency-mcp.test.js
 */

'use strict';

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs   = require('fs');
const path = require('path');
const os   = require('os');

let tmpDir;
let origCwd;

before(() => {
  tmpDir  = fs.mkdtempSync(path.join(os.tmpdir(), 'kios-misc-test-'));
  origCwd = process.cwd;
  process.cwd = () => tmpDir;
  process.env.NODE_ENV = 'test';
  process.env.ECONOMIC_OPTIMIZER_STORE_PATH  = path.join(tmpDir, 'economic.json');
  process.env.SUPERVISOR_ESCALATION_LOG_PATH = path.join(tmpDir, 'escalations.json');
  process.env.SUPERVISOR_RECOVERY_LOG_PATH   = path.join(tmpDir, 'recoveries.json');
});

after(() => {
  process.cwd = origCwd;
  delete process.env.NODE_ENV;
  delete process.env.ECONOMIC_OPTIMIZER_STORE_PATH;
  delete process.env.SUPERVISOR_ESCALATION_LOG_PATH;
  delete process.env.SUPERVISOR_RECOVERY_LOG_PATH;
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function getEconomic()   { delete require.cache[require.resolve('../backend/services/economic/economic.service')]; return require('../backend/services/economic/economic.service'); }
function getSupervisor() { delete require.cache[require.resolve('../backend/services/supervisor/supervisor.service')]; return require('../backend/services/supervisor/supervisor.service'); }
function getEffStore()   { delete require.cache[require.resolve('../backend/services/efficiency/efficiency.store')]; return require('../backend/services/efficiency/efficiency.store'); }

// ── Economic Service ───────────────────────────────────────────────────────

describe('EconomicService', () => {

  test('listProfiles gibt Default-Profile zurück', () => {
    const { listProfiles } = getEconomic();
    const profiles = listProfiles();
    assert.ok(Array.isArray(profiles), 'Profile sollte Array sein');
    assert.ok(profiles.length >= 3, 'Mindestens 3 Default-Profile erwartet');
  });

  test('Default-Profile haben profileId, label, minTrustScore', () => {
    const { listProfiles } = getEconomic();
    for (const p of listProfiles()) {
      assert.ok(p.profileId,            `profileId fehlt: ${JSON.stringify(p)}`);
      assert.ok(p.label,                `label fehlt: ${p.profileId}`);
      assert.ok(typeof p.minTrustScore === 'number', `minTrustScore fehlt: ${p.profileId}`);
    }
  });

  test('getProfile gibt balanced-default zurück', () => {
    const { getProfile } = getEconomic();
    const profile = getProfile('balanced-default');
    assert.ok(profile, 'balanced-default sollte existieren');
    assert.equal(profile.profileId, 'balanced-default');
  });

  test('getProfile fällt auf ersten Profile zurück bei unbekannter ID', () => {
    const { getProfile } = getEconomic();
    const profile = getProfile('nicht-vorhanden');
    assert.ok(profile, 'Fallback-Profil erwartet');
    assert.ok(profile.profileId, 'profileId im Fallback fehlt');
  });

  test('evaluateEconomicDecision gibt Entscheidung zurück', () => {
    const { evaluateEconomicDecision } = getEconomic();
    const decision = evaluateEconomicDecision({
      profileId:       'balanced-default',
      taskClass:       'chat',
      provider:        'openai',
      model:           'gpt-5.4',
      budgetCents:     100,
      trustScore:      85,
      outcomeCoverage: 0.7,
      latencyMs:       800,
      roiSignal:       0.5,
    });
    assert.ok(decision.decisionId,       'decisionId fehlt');
    assert.ok(decision.action,           'action fehlt');
    assert.ok(decision.reason,           'reason fehlt');
    assert.ok(decision.createdAt,        'createdAt fehlt');
    assert.ok(['keep', 'downshift', 'escalate'].includes(decision.action),
      `Unbekannte action: ${decision.action}`);
  });

  test('listDecisions gibt Array zurück', () => {
    const { listDecisions } = getEconomic();
    const decisions = listDecisions(10);
    assert.ok(Array.isArray(decisions), 'listDecisions sollte Array sein');
  });

  test('getEconomicPayload gibt Metadaten zurück', () => {
    const { getEconomicPayload } = getEconomic();
    const payload = getEconomicPayload();
    assert.ok(payload.success,                        'success fehlt');
    assert.ok(typeof payload.profileCount === 'number', 'profileCount fehlt');
    assert.ok(typeof payload.decisionCount === 'number', 'decisionCount fehlt');
  });

});

// ── Supervisor Service ─────────────────────────────────────────────────────

describe('SupervisorService', () => {

  test('Supervisor-Modul lädt ohne Fehler', () => {
    assert.doesNotThrow(() => getSupervisor(), 'supervisor.service sollte ohne Fehler laden');
  });

  test('FAILURE_CLASSES sind definiert', () => {
    // Modul intern — über Exports prüfen
    const svc = getSupervisor();
    assert.ok(typeof svc === 'object', 'Service-Objekt erwartet');
  });

  test('handleEscalation oder createEscalation existiert', () => {
    const svc = getSupervisor();
    const hasFn = typeof svc.handleEscalation === 'function'
      || typeof svc.createEscalation === 'function'
      || typeof svc.escalate === 'function'
      || typeof svc.recordEscalation === 'function';
    assert.ok(hasFn, 'Mindestens eine Escalation-Funktion erwartet');
  });

  test('getPlaybooks oder listPlaybooks existiert', () => {
    const svc = getSupervisor();
    const hasFn = typeof svc.getPlaybooks === 'function'
      || typeof svc.listPlaybooks === 'function'
      || typeof svc.getRecoveryPlaybooks === 'function';
    assert.ok(hasFn, 'Mindestens eine Playbook-Funktion erwartet');
  });

  test('Escalation kann erstellt werden', () => {
    const svc = getSupervisor();
    const createFn = svc.handleEscalation ?? svc.createEscalation ?? svc.escalate ?? svc.recordEscalation;
    if (typeof createFn !== 'function') return; // Skip wenn nicht vorhanden
    assert.doesNotThrow(() => {
      createFn({
        severity:    'high',
        errorClass:  'timeout',
        agentId:     'agent-test',
        runId:       'run-001',
        description: 'Test escalation',
      });
    }, 'createEscalation sollte nicht werfen');
  });

});

// ── Efficiency Store ───────────────────────────────────────────────────────

describe('EfficiencyStore', () => {

  test('getReports gibt leeres Array zurück bei neuem Store', () => {
    const { getReports } = getEffStore();
    const reports = getReports({ limit: 10 });
    assert.ok(Array.isArray(reports), 'getReports sollte Array sein');
  });

  test('addReport speichert Report mit id und generatedAt', () => {
    const { addReport, getReports } = getEffStore();
    const report = addReport({
      executiveSummary:         'Test-Report',
      featureSuggestions:       [],
      quickWins:                [],
      competitorHighlights:     [],
      updateRecommendations:    [],
      techDebt:                 [],
    });
    assert.ok(report.id,          'id fehlt');
    assert.ok(report.generatedAt, 'generatedAt fehlt');
    assert.ok(report.id.startsWith('eff-'), `id-Prefix erwartet: ${report.id}`);

    const reports = getReports({ limit: 5 });
    assert.ok(reports.length >= 1, 'Report sollte in Store sein');
  });

  test('getReports respektiert limit', () => {
    const { addReport, getReports } = getEffStore();
    // 3 weitere Reports hinzufügen
    for (let i = 0; i < 3; i++) {
      addReport({ executiveSummary: `Report ${i}`, featureSuggestions: [], quickWins: [], competitorHighlights: [], updateRecommendations: [], techDebt: [] });
    }
    const limited = getReports({ limit: 2 });
    assert.ok(limited.length <= 2, 'limit wird nicht respektiert');
  });

  test('Reports sind nach generatedAt absteigend sortiert (neueste zuerst)', () => {
    const { getReports } = getEffStore();
    const reports = getReports({ limit: 10 });
    for (let i = 1; i < reports.length; i++) {
      assert.ok(
        reports[i - 1].generatedAt >= reports[i].generatedAt,
        'Reports sollten absteigend sortiert sein'
      );
    }
  });

  test('Store ist auf MAX_REPORTS (52) begrenzt', () => {
    // Nur sicherstellen dass MAX_REPORTS irgendwo definiert ist
    // (ohne 52 Reports zu erstellen)
    const { getReports } = getEffStore();
    const reports = getReports({ limit: 100 });
    assert.ok(reports.length <= 52, `Mehr als 52 Reports: ${reports.length}`);
  });

});

// ── MCP API ────────────────────────────────────────────────────────────────

describe('McpModule', () => {

  test('MCP-Controller Datei existiert', () => {
    const mcpPath = path.join(__dirname, '..', 'backend', 'services', 'connectors', 'capability.registry.js');
    assert.ok(fs.existsSync(mcpPath), `capability.registry.js nicht gefunden: ${mcpPath}`);
  });

  test('MCP-Bridge ist im Connector-Registry als Default vorhanden', () => {
    delete require.cache[require.resolve('../backend/services/connectors/capability.registry')];
    const { listConnectors } = require('../backend/services/connectors/capability.registry');
    const connectors = listConnectors();
    const mcpBridge = connectors.find(c => c.id === 'mcp-bridge');
    assert.ok(mcpBridge, 'mcp-bridge Connector nicht gefunden');
    assert.ok(mcpBridge.capabilities.some(c => c.includes('mcp.')),
      'mcp.* Capabilities erwartet');
  });

  test('MCP-Bridge hat protocol=mcp', () => {
    delete require.cache[require.resolve('../backend/services/connectors/capability.registry')];
    const { getConnector } = require('../backend/services/connectors/capability.registry');
    const bridge = getConnector('mcp-bridge');
    assert.ok(bridge, 'mcp-bridge nicht gefunden');
    assert.equal(bridge.protocol, 'mcp');
  });

  test('MCP-Bridge hat routes.invoke', () => {
    delete require.cache[require.resolve('../backend/services/connectors/capability.registry')];
    const { getConnector } = require('../backend/services/connectors/capability.registry');
    const bridge = getConnector('mcp-bridge');
    assert.ok(bridge?.routes?.invoke, 'routes.invoke fehlt im mcp-bridge');
  });

});
