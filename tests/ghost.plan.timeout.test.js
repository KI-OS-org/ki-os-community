'use strict';
const { test } = require('node:test');
const assert   = require('node:assert');
const path     = require('path');

const PLAN_MODULE       = require.resolve('../backend/services/ghost/ghost.plan.service');
const OPENROUTER_MODULE = require.resolve('../backend/services/providers/openrouter.provider');
const ANTHROPIC_MODULE  = require.resolve('../backend/services/providers/anthropic.provider');
const OPENAI_MODULE     = require.resolve('../backend/services/providers/openai.provider');

function mockAllProviders(errorMsg) {
  const fakeChatFn = async () => { throw new Error(errorMsg); };
  require.cache[OPENROUTER_MODULE] = { id: OPENROUTER_MODULE, filename: OPENROUTER_MODULE, loaded: true, exports: { chat: fakeChatFn } };
  require.cache[ANTHROPIC_MODULE]  = { id: ANTHROPIC_MODULE,  filename: ANTHROPIC_MODULE,  loaded: true, exports: { chat: fakeChatFn } };
  require.cache[OPENAI_MODULE]     = { id: OPENAI_MODULE,     filename: OPENAI_MODULE,     loaded: true, exports: { callOpenAI: fakeChatFn } };
  // Reload plan service so it picks up mocked providers
  delete require.cache[PLAN_MODULE];
}

function restoreProviders() {
  delete require.cache[OPENROUTER_MODULE];
  delete require.cache[ANTHROPIC_MODULE];
  delete require.cache[OPENAI_MODULE];
  delete require.cache[PLAN_MODULE];
}

// ─── Tests ────────────────────────────────────────────────────────────────────

test('generatePlan — leeres Ziel bricht nicht ab (graceful)', async () => {
  mockAllProviders('API key not set');
  try {
    const { generatePlan } = require(PLAN_MODULE);
    const result = await generatePlan('', 'demo');
    // Service wirft nicht — Fallback oder needsClarification
    assert.ok(typeof result === 'object');
  } finally {
    restoreProviders();
  }
});

test('generatePlan — ohne API Keys → needsClarification: true', async () => {
  mockAllProviders('API key not set');
  try {
    const { generatePlan } = require(PLAN_MODULE);
    const r = await generatePlan('Erstelle einen Agenten');
    assert.strictEqual(r.needsClarification, true);
    assert.ok(typeof r.question === 'string' && r.question.length > 0);
  } finally {
    restoreProviders();
  }
});

test('generatePlan — LLM timeout → needsClarification: true, Frage enthält Hinweis', async () => {
  mockAllProviders('Ghost Plan LLM timeout after 20000ms');
  try {
    const { generatePlan } = require(PLAN_MODULE);
    const r = await generatePlan('Erstelle einen Agenten');
    assert.strictEqual(r.needsClarification, true);
    assert.ok(
      r.question.includes('langsam') || r.question.includes('timeout') || r.question.includes('erneut'),
      `Frage erwartet Timeout-Hinweis, got: "${r.question}"`
    );
  } finally {
    restoreProviders();
  }
});

test('generatePlan — 429 Rate Limit → needsClarification: true', async () => {
  mockAllProviders('429 Too Many Requests');
  try {
    const { generatePlan } = require(PLAN_MODULE);
    const r = await generatePlan('Erstelle einen Agenten');
    assert.strictEqual(r.needsClarification, true);
  } finally {
    restoreProviders();
  }
});

test('generatePlan — 503 Service Unavailable → needsClarification: true', async () => {
  mockAllProviders('503 Service Unavailable');
  try {
    const { generatePlan } = require(PLAN_MODULE);
    const r = await generatePlan('Erstelle einen Agenten');
    assert.strictEqual(r.needsClarification, true);
  } finally {
    restoreProviders();
  }
});
