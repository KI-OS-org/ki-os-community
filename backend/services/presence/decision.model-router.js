/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
// (c) 2026 KI-OS.org by Ingo Schaffer und Kimba — AGPL-3.0-only
'use strict';

const axios = require('axios');

const DEFAULT_MODELS = {
  financial: 'deepseek/deepseek-r1',
  strategic: 'anthropic/claude-sonnet-4-6',
  technical: 'qwen/qwen3-coder',
  operational: 'mistralai/codestral-2508',
  legal: 'deepseek/deepseek-r1',
  default: 'mistralai/codestral-2508'
};

function getModel(decisionClass) {
  const envVarName = `DECISION_MODEL_${decisionClass.toUpperCase()}`;
  return process.env[envVarName] || DEFAULT_MODELS[decisionClass] || DEFAULT_MODELS.default;
}

function getModelInfo() {
  return {
    financial: getModel('financial'),
    strategic: getModel('strategic'),
    technical: getModel('technical'),
    operational: getModel('operational'),
    legal: getModel('legal'),
    default: getModel('default')
  };
}

async function callDecisionLLM(systemPrompt, userPrompt, decisionClass) {
  if (process.env.DECISION_LLM_MOCK === 'true') {
    return JSON.stringify({
      question: 'Was sind die nächsten Schritte nach dem Meeting?',
      recommendation: 'Erstelle eine detaillierte Liste der nächsten Schritte und weise Verantwortliche zu.',
      why: 'Strukturiertes Vorgehen erhöht die Umsetzungswahrscheinlichkeit.',
      risk: 'Ohne klare Verantwortliche könnten Schritte offen bleiben.',
      alternatives: ['Kurzes Follow-up-Meeting', 'Asynchrone Abstimmung per Chat'],
      nextStep: 'Aufgabenliste erstellen und verteilen.',
      generatedBy: 'KIMBA Mock'
    });
  }

  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error('OPENROUTER_API_KEY environment variable is not set');
  }

  const model = getModel(decisionClass);
  const timeout = parseInt(process.env.DECISION_LLM_TIMEOUT_MS) || 30000;
  const maxTokens = parseInt(process.env.DECISION_MAX_TOKENS) || 1000;

  const requestBody = {
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    max_tokens: maxTokens,
    temperature: 0.3
  };

  try {
    const response = await axios.post(
      `${process.env.OPENROUTER_API_BASE || 'https://openrouter.ai/api'}/chat/completions`,
      requestBody,
      {
        headers: {
          'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout
      }
    );

    return response.data.choices[0].message.content;
  } catch (error) {
    throw new Error(`LLM request failed: ${error.message}`);
  }
}

module.exports = {
  getModel,
  getModelInfo,
  callDecisionLLM
};
