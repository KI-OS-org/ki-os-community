/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
/**
 * Reflection-Engine Tests
 * 
 * Tests für:
 * - Scorecard (Quality, Cost, Latency, Tool-Choice)
 * - LLM Reflection
 * - Swarm Memory Integration
 * 
 * @module services/reflection/__tests__/reflection.service.test.js
 * @license AGPL-3.0
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { ReflectionScorecard } = require('../reflection.service');

// ─── SCORECARD TESTS ───────────────────────────────────────────────────────────

test.describe('ReflectionScorecard', () => {
  test('should evaluate quality (good output)', () => {
    const scorecard = new ReflectionScorecard({
      task: 'Erstelle einen Agenten für Customer-Support mit Ticket-Erstellung',
      output: 'Der Agent wurde erfolgreich erstellt. Er kann Kundenanfragen bearbeiten, Tickets erstellen und Eskalationen durchführen. Die Integration mit dem CRM-System ist ebenfalls vorhanden.',
      reviewerScore: 0.9,
    });

    const result = scorecard.evaluateQuality();

    assert.ok(result.score >= 0.7);
    assert.ok(result.reasons.includes('output_length_ok'));
    // Task-Keywords: "Agenten", "Customer-Support", "Ticket-Erstellung" — output hat "Agent", "Tickets"
    assert.ok(result.reasons.length >= 2); // Mindestens 2 reasons
  });

  test('should evaluate quality (short output)', () => {
    const scorecard = new ReflectionScorecard({
      task: 'Erstelle einen Agenten für Customer-Support',
      output: 'Agent erstellt.',
    });

    const result = scorecard.evaluateQuality();

    assert.ok(result.score < 0.5);
  });

  test('should evaluate costs (within budget)', () => {
    const scorecard = new ReflectionScorecard({
      budgetCapUSD: 10,
      actualCostUSD: 2.50,
    });

    const result = scorecard.evaluateCosts();

    assert.ok(result.score >= 0.8); // 25% = 0.5 + 0.3 = 0.8
    assert.ok(result.reasons.includes('within_budget'));
    assert.ok(result.reasons.includes('cost_efficient'));
  });

  test('should evaluate costs (over budget)', () => {
    const scorecard = new ReflectionScorecard({
      budgetCapUSD: 10,
      actualCostUSD: 15,
    });

    const result = scorecard.evaluateCosts();

    assert.equal(result.score, 0);
    assert.ok(!result.reasons.includes('within_budget'));
  });

  test('should evaluate latency (fast)', () => {
    const scorecard = new ReflectionScorecard({
      latencyMs: 3000,
    });

    const result = scorecard.evaluateLatency();

    assert.equal(result.score, 1);
    assert.ok(result.reasons.includes('latency_under_30s'));
    assert.ok(result.reasons.includes('latency_under_10s'));
    assert.ok(result.reasons.includes('latency_excellent'));
  });

  test('should evaluate latency (slow)', () => {
    const scorecard = new ReflectionScorecard({
      latencyMs: 45000,
    });

    const result = scorecard.evaluateLatency();

    assert.equal(result.score, 0);
  });

  test('should evaluate tool choice (efficient)', () => {
    const scorecard = new ReflectionScorecard({
      toolsUsed: ['web_search'],
      taskType: 'research',
    });

    const result = scorecard.evaluateToolChoice();

    assert.ok(result.score >= 0.8);
    assert.ok(result.reasons.includes('tool_count_efficient'));
    assert.ok(result.reasons.includes('research_tool_used'));
  });

  test('should evaluate tool choice (too many tools)', () => {
    const scorecard = new ReflectionScorecard({
      toolsUsed: ['web_search', 'file_read', 'code_exec', 'api_call', 'memory', 'browser'],
    });

    const result = scorecard.evaluateToolChoice();

    assert.ok(result.score < 0.8);
    assert.ok(!result.reasons.includes('tool_count_ok'));
  });

  test('should calculate overall score', () => {
    const scorecard = new ReflectionScorecard({
      task: 'Test Task',
      output: 'Good output with enough length.',
      budgetCapUSD: 10,
      actualCostUSD: 3,
      latencyMs: 8000,
      toolsUsed: ['web_search'],
      taskType: 'research',
      reviewerScore: 0.8,
    });

    scorecard.evaluateQuality();
    scorecard.evaluateCosts();
    scorecard.evaluateLatency();
    scorecard.evaluateToolChoice();
    const overall = scorecard.calculateOverall();

    assert.ok(overall >= 0.7);
    assert.ok(overall <= 1);
  });

  test('should return full scorecard', () => {
    const scorecard = new ReflectionScorecard({
      runId: 'test-run-123',
      task: 'Test Task',
    });

    scorecard.evaluateQuality();
    scorecard.evaluateCosts();
    scorecard.evaluateLatency();
    scorecard.evaluateToolChoice();
    scorecard.calculateOverall();

    const full = scorecard.getScorecard();

    assert.equal(full.runId, 'test-run-123');
    assert.ok('quality_score' in full);
    assert.ok('cost_score' in full);
    assert.ok('latency_score' in full);
    assert.ok('tool_choice_score' in full);
    assert.ok('overall_score' in full);
    assert.ok('timestamp' in full);
  });
});

// ─── INTEGRATION TESTS (MOCKED) ────────────────────────────────────────────────

test.describe('Reflection Integration', () => {
  test('should reflect on run (mocked LLM)', async () => {
    // Mock LLM-Call
    const { reflect } = require('../reflection.service');
    
    // Temporärer Mock für llmRouter
    const llmRouter = require('../../core/llm.router');
    const originalCall = llmRouter.call;
    llmRouter.call = async () => JSON.stringify({
      whatWorked: ['Good quality output'],
      whatFailed: ['Cost was high'],
      nextTime: ['Use cheaper model'],
      savedCosts: 0.50,
      improvedLatency: 2000,
      confidence: 0.85,
    });

    try {
      const result = await reflect({
        runId: 'test-run-456',
        task: 'Create a customer support agent',
        output: 'Agent created successfully with all required capabilities.',
        toolsUsed: ['web_search'],
        actualCostUSD: 3.50,
        budgetCapUSD: 10,
        latencyMs: 8000,
        reviewerScore: 0.8,
        taskType: 'coding',
      });

      assert.equal(result.runId, 'test-run-456');
      assert.ok('scorecard' in result);
      assert.ok('llmReflection' in result);
    } finally {
      llmRouter.call = originalCall;
    }
  });

  test('should skip reflection if disabled', async () => {
    process.env.REFLECTION_ENABLED = 'false';
    
    // Module neu laden damit Env-Variable wirkt
    delete require.cache[require.resolve('../reflection.service')];
    const { reflect } = require('../reflection.service');
    
    const result = await reflect({
      runId: 'test-run-789',
      task: 'Test',
    });

    assert.equal(result.skipped, true);
    assert.equal(result.reason, 'reflection_disabled');
    
    delete process.env.REFLECTION_ENABLED;
  });
});
