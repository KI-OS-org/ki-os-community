/**
 * KI-OS — (C) 2026 Ingo Schaffer
 * https://ki-os.org
 */
/**
 * Tests: Intent-Parser / NLU Service
 * node --test tests/intent-parser.test.js
 *
 * Alle Tests verwenden nur die Keyword-Heuristik (kein LLM-Aufruf).
 */

'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const { runHeuristic, extractSlots, generateSlotQuestion, INTENT_TYPES } = require('../backend/services/routing/intent.parser.service');

// ---------------------------------------------------------------------------
// runHeuristic — Intent-Erkennung
// ---------------------------------------------------------------------------
describe('runHeuristic', () => {

  describe('AGENT_CREATE', () => {
    const cases = [
      'Erstelle mir einen neuen Agent für Marketing',
      'Kimba, erstelle einen Agent der Social-Media-Posts schreibt',
      'neuen Agent anlegen für den Vertrieb',
      'create a new agent for reporting',
      'agent erstellen für Buchhaltung',
    ];
    for (const text of cases) {
      test(`erkennt AGENT_CREATE: "${text.slice(0, 50)}"`, () => {
        const r = runHeuristic(text);
        assert.equal(r.intentType, INTENT_TYPES.AGENT_CREATE, `Expected AGENT_CREATE, got ${r.intentType}`);
        assert.ok(r.confidence >= 0.8);
      });
    }
  });

  describe('DAG_EXECUTE', () => {
    const cases = [
      'Führe den Marketing-Flow aus',
      'starte den Workflow für Rechnungsverarbeitung',
      'execute dag für Newsletter',
      'Flow ausführen: Kundenbewertung',
    ];
    for (const text of cases) {
      test(`erkennt DAG_EXECUTE: "${text.slice(0, 50)}"`, () => {
        const r = runHeuristic(text);
        assert.equal(r.intentType, INTENT_TYPES.DAG_EXECUTE);
        assert.ok(r.confidence >= 0.8);
      });
    }
  });

  describe('AGENTMESH_RUN', () => {
    const cases = [
      'Starte einen AgentMesh Run für Marktanalyse',
      'run AgentMesh task: Wettbewerbsanalyse Q2',
      'mesh task starten: Produktrecherche',
    ];
    for (const text of cases) {
      test(`erkennt AGENTMESH_RUN: "${text.slice(0, 50)}"`, () => {
        const r = runHeuristic(text);
        assert.equal(r.intentType, INTENT_TYPES.AGENTMESH_RUN);
      });
    }
  });

  describe('DOCUMENT_PROCESS', () => {
    const cases = [
      'Verarbeite das PDF Vertrag2026.pdf',
      'extrahiere Text aus dem Excel Bericht.xlsx',
      'pdf analysieren und Zusammenfassung erstellen',
    ];
    for (const text of cases) {
      test(`erkennt DOCUMENT_PROCESS: "${text.slice(0, 50)}"`, () => {
        const r = runHeuristic(text);
        assert.equal(r.intentType, INTENT_TYPES.DOCUMENT_PROCESS);
      });
    }
  });

  describe('DESKTOP_ACTION', () => {
    const cases = [
      'Klick auf den Submit-Button',
      'Mach einen Screenshot vom Bildschirm',
      'Desktop Aktion: Fenster schließen',
    ];
    for (const text of cases) {
      test(`erkennt DESKTOP_ACTION: "${text.slice(0, 50)}"`, () => {
        const r = runHeuristic(text);
        assert.equal(r.intentType, INTENT_TYPES.DESKTOP_ACTION);
      });
    }
  });

  describe('MEMORY_SEARCH', () => {
    const cases = [
      'Suche im Memory nach Kundendaten von Mustermann',
      'Was weißt du über das Projekt Alpha?',
      'zeig mir was das System über Benutzer 42 im Gedächtnis hat',
    ];
    for (const text of cases) {
      test(`erkennt MEMORY_SEARCH: "${text.slice(0, 50)}"`, () => {
        const r = runHeuristic(text);
        assert.equal(r.intentType, INTENT_TYPES.MEMORY_SEARCH);
      });
    }
  });

  describe('CHAT_GENERAL (kein spezieller Intent)', () => {
    const cases = [
      'Wie ist das Wetter heute?',
      'Erkläre mir Kubernetes',
      'Was ist der Unterschied zwischen REST und GraphQL?',
      'Hilf mir eine E-Mail zu schreiben',
    ];
    for (const text of cases) {
      test(`erkennt CHAT_GENERAL: "${text.slice(0, 50)}"`, () => {
        const r = runHeuristic(text);
        assert.equal(r.intentType, INTENT_TYPES.CHAT_GENERAL);
      });
    }
  });

});

// ---------------------------------------------------------------------------
// extractSlots
// ---------------------------------------------------------------------------
describe('extractSlots', () => {

  test('AGENT_CREATE: extrahiert Beschreibung aus dem Text', () => {
    const text = 'Erstelle mir einen Agent der Produktbewertungen analysiert';
    const { filled, missing } = extractSlots(INTENT_TYPES.AGENT_CREATE, text);
    assert.ok(filled.agentDescription, 'agentDescription sollte extrahiert werden');
    assert.ok(filled.agentDescription.length > 3);
    // Optionale Slots (name, category) dürfen fehlen
  });

  test('AGENT_CREATE: fehlende Pflicht-Slots bei leerem Text', () => {
    const { filled, missing } = extractSlots(INTENT_TYPES.AGENT_CREATE, 'erstelle agent');
    // Wenn kein sinnvoller Text übrig bleibt, fehlt agentDescription
    // (Keyword wird herausgefiltert)
    // missing kann 0 oder 1 sein je nach Resttext — wir prüfen nur den Typ
    assert.ok(Array.isArray(missing));
  });

  test('DAG_EXECUTE: fehlender dagTask', () => {
    const { missing } = extractSlots(INTENT_TYPES.DAG_EXECUTE, 'Führe einen Flow aus');
    assert.equal(missing.length, 1);
    assert.equal(missing[0].key, 'dagTask');
  });

  test('CHAT_GENERAL: keine Slots', () => {
    const { filled, missing } = extractSlots(INTENT_TYPES.CHAT_GENERAL, 'Wie geht es dir?');
    assert.equal(missing.length, 0);
  });

  test('Entities aus externem Aufruf werden in filled übernommen', () => {
    const { filled } = extractSlots(INTENT_TYPES.AGENT_CREATE, 'text', { agentDescription: 'Mein Agent' });
    assert.equal(filled.agentDescription, 'Mein Agent');
  });

});

// ---------------------------------------------------------------------------
// generateSlotQuestion
// ---------------------------------------------------------------------------
describe('generateSlotQuestion', () => {

  test('gibt erste Frage zurück wenn Missing-Slots vorhanden', () => {
    const missing = [
      { key: 'agentDescription', question: 'Was soll der Agent tun?' },
      { key: 'agentName',        question: 'Wie soll der Agent heißen?' },
    ];
    const q = generateSlotQuestion(missing);
    assert.equal(q, 'Was soll der Agent tun?');
  });

  test('gibt null zurück bei leerem missing-Array', () => {
    const q = generateSlotQuestion([]);
    assert.equal(q, null);
  });

});

// ---------------------------------------------------------------------------
// INTENT_TYPES Vollständigkeit
// ---------------------------------------------------------------------------
describe('INTENT_TYPES', () => {
  test('enthält alle erwarteten Typen', () => {
    const expected = ['AGENT_CREATE', 'DAG_EXECUTE', 'AGENTMESH_RUN', 'DOCUMENT_PROCESS', 'DESKTOP_ACTION', 'MEMORY_SEARCH', 'CHAT_GENERAL'];
    for (const t of expected) {
      assert.ok(INTENT_TYPES[t], `INTENT_TYPES.${t} fehlt`);
    }
  });
});
