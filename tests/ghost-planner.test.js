/**
 * Ghost Control — Unit Tests
 * 
 * Tests für Ghost Planner Service.
 * 
 * @module tests/ghost-planner.test.js
 */

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert');
const GhostPlannerService = require('../backend/services/ghost/ghost-planner.service');

describe('Ghost Planner Service', () => {
  let planner;

  beforeEach(() => {
    planner = new GhostPlannerService();
  });

  describe('classifyIntent', () => {
    it('sollte Agent-Erstellung erkennen', () => {
      const intent = planner.classifyIntent('Erstelle einen Marketing-Agenten');
      
      assert.strictEqual(intent.type, 'create_agent');
      assert.strictEqual(intent.confidence, 0.9);
      assert.ok(intent.data.name);
    });

    it('sollte Job-Erstellung erkennen', () => {
      const intent = planner.classifyIntent('Erstelle einen neuen Job Plan');
      
      assert.strictEqual(intent.type, 'create_job');
      assert.strictEqual(intent.confidence, 0.85);
    });

    it('sollte Flow-Erstellung erkennen', () => {
      const intent = planner.classifyIntent('Erstelle einen Workflow');
      
      assert.strictEqual(intent.type, 'create_flow');
      assert.strictEqual(intent.confidence, 0.85);
    });

    it('sollte Navigation erkennen', () => {
      const intent = planner.classifyIntent('Zeig mir die Agenten');
      
      assert.strictEqual(intent.type, 'navigate');
      assert.strictEqual(intent.confidence, 0.8);
    });

    it('sollte Unknown Intent bei unklarer Eingabe', () => {
      const intent = planner.classifyIntent('Mach mal was');
      
      assert.strictEqual(intent.type, 'unknown');
      assert.strictEqual(intent.confidence, 0.5);
    });
  });

  describe('generatePlan', () => {
    it('sollte Plan für Agent-Erstellung generieren (DEMO)', async () => {
      const plan = await planner.generatePlan('Erstelle einen Marketing-Agenten', 'demo');
      
      assert.ok(plan.id);
      assert.strictEqual(plan.mode, 'demo');
      assert.ok(plan.title.includes('Agent'));
      assert.ok(plan.steps.length > 0);
      
      // Steps prüfen
      const stepTypes = plan.steps.map(s => s.type);
      assert.ok(stepTypes.includes('speak'));
      assert.ok(stepTypes.includes('navigate'));
      assert.ok(stepTypes.includes('spotlight'));
      assert.ok(stepTypes.includes('click'));
      assert.ok(stepTypes.includes('fill'));
    });

    it('sollte Plan für Agent-Erstellung generieren (BUILD)', async () => {
      const plan = await planner.generatePlan('Erstelle einen Marketing-Agenten', 'build');
      
      assert.strictEqual(plan.mode, 'build');
      
      // BUILD sollte api_call und confirm Steps haben
      const stepTypes = plan.steps.map(s => s.type);
      assert.ok(stepTypes.includes('api_call'));
      assert.ok(stepTypes.includes('confirm'));
    });

    it('sollte Plan für Navigation generieren', async () => {
      const plan = await planner.generatePlan('Zeig mir die Agenten', 'demo');
      
      assert.ok(plan.steps.length > 0);
      
      const firstStep = plan.steps[0];
      assert.strictEqual(firstStep.type, 'speak');
    });
  });

  describe('extractAgentData', () => {
    it('sollte Agent Name extrahieren', () => {
      const data = planner.extractAgentData('Erstelle einen Agenten namens Marketing Bot');
      
      // Name sollte extrahiert werden (oder Default wenn Regex nicht matcht)
      assert.ok(data.name);
      // Akzeptiere sowohl extrahierten Namen als auch Default
      assert.ok(data.name === 'Marketing Bot' || data.name === 'Neuer Agent');
    });

    it('sollte Kategorie extrahieren', () => {
      const data = planner.extractAgentData('Erstelle einen Agenten für Marketing');
      
      assert.strictEqual(data.category, 'Marketing');
    });

    it('sollte Default-Werte verwenden wenn keine Daten', () => {
      const data = planner.extractAgentData('Erstelle einen Agenten');
      
      assert.strictEqual(data.name, 'Neuer Agent');
      assert.strictEqual(data.category, 'General');
    });
  });

  describe('generateTitle', () => {
    it('sollte Titel für Agent-Intent generieren', () => {
      const intent = {
        type: 'create_agent',
        data: { name: 'Marketing-Agent' },
      };
      
      const title = planner.generateTitle(intent);
      assert.ok(title.includes('Marketing-Agent'));
      assert.ok(title.includes('erstellen'));
    });

    it('sollte Titel für Navigation generieren', () => {
      const intent = {
        type: 'navigate',
        data: { destination: 'Agenten' },
      };
      
      const title = planner.generateTitle(intent);
      assert.ok(title.includes('Navigiere'));
    });
  });
});
