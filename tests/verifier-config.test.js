/**
 * (c) 2026 KI-OS.org (v6.0) by Ingo Schaffer und Kimba
 * Datei: verifier-config.test.js
 * Diese Datei enthält automatisierte Tests zur Verifikation von Verhalten, Stabilität und Regressionen im KI-OS AgentMesh.
 */

'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const verifierPath = path.resolve(__dirname, '../backend/services/verifier.service.js');

test('verifier rejects without keys when fail-open is false', async () => {
  delete process.env.OPENAI_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.GEMINI_API_KEY;
  process.env.VERIFIER_FAIL_OPEN = 'false';
  delete require.cache[verifierPath];
  const { verifyAnswer } = require(verifierPath);
  const res = await verifyAnswer({ answer: 'x', sources: [] });
  assert.equal(res.verdict, 'reject');
});

test('verifier approves without keys when fail-open is true', async () => {
  delete process.env.OPENAI_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.GEMINI_API_KEY;
  process.env.VERIFIER_FAIL_OPEN = 'true';
  delete require.cache[verifierPath];
  const { verifyAnswer } = require(verifierPath);
  const res = await verifyAnswer({ answer: 'x', sources: [] });
  assert.equal(res.verdict, 'approve');
});
