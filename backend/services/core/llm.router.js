/**
 * KI-OS Community Edition — Core Infrastructure
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: Apache License 2.0
 * SPDX-License-Identifier: Apache-2.0
 */
/**
 * (c) 2026 KI-OS.org by Ingo Schaffer und Kimba
 * @license AGPL-3.0-only
 */

'use strict';

const Anthropic = require('../providers/anthropic.provider');
const OpenRouter = require('../providers/openrouter.provider');
const OpenAI = require('../providers/openai.provider');
const DeepSeek = require('../providers/deepseek.provider');
const Gemini = require('../providers/gemini.provider');
const DashScopeProvider = require('../../../backend/providers/dashscope-provider.js');
const circuitBreaker = require('./circuit-breaker');
const queue = require('./llm.queue');
const logger = require('./logger.service');
let _eventBus = null;
function _getBus() {
  if (!_eventBus) try { _eventBus = require('../ui/ui.eventbus'); } catch {}
  return _eventBus;
}

// Kostenabschätzung per 1M Tokens (Stand 2026-04)
const _COST_PER_1M = {
  'anthropic': { input: 3.00, output: 15.00 },
  'deepseek': { input: 0.27, output: 1.10 },
  'qwen': { input: 0.35, output: 0.40 },
  'openai': { input: 2.00, output: 8.00 },
  'gemini': { input: 0.10, output: 0.40 },
};
function _estimateCost(provider, outputTokens = 500) {
  const p = _COST_PER_1M[provider] || { input: 1.00, output: 4.00 };
  return Number(((500 * p.input + outputTokens * p.output) / 1_000_000).toFixed(6));
}

// Policy-Override Lazy-Load (vermeidet zirkuläre Abhängigkeit beim Start)
function _getTowerPolicy() {
  try { return require('../tower/tower.service'); } catch { return null; }
}

const RETRY_DELAYS_MS = [800, 1600, 3200];
const CLAUDE_HAIKU_MODEL = 'claude-haiku-4-5-20251001';

function detectFamily(model) {
  const value = String(model || '').toLowerCase();
  if (value.startsWith('deepseek/') || value === 'deepseek-chat' || value === 'deepseek-reasoner') return 'deepseek';
  if (value.startsWith('qwen/') || value.startsWith('qwen-')) return 'qwen';
  if (value.startsWith('gpt-') || value.startsWith('o1') || value.startsWith('o3')) return 'openai';
  if (value.startsWith('gemini') || value.startsWith('google/')) return 'gemini';
  return 'anthropic';
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getStatusCode(error) {
  if (!error) return undefined;
  if (error.statusCode) return Number(error.statusCode);
  if (error.response && error.response.status) return Number(error.response.status);

  const message = String(error.message || '');
  const match = message.match(/\b(429|503|529)\b/);
  return match ? Number(match[1]) : undefined;
}

function shouldRetry(error) {
  const statusCode = getStatusCode(error);
  return statusCode === 429 || statusCode === 503 || statusCode === 529;
}

function extractText(result) {
  if (typeof result === 'string') return result;
  if (!result || typeof result !== 'object') return '';
  return result.text || result.reply || result.content || '';
}

function buildMessages(systemPrompt, userPrompt) {
  const messages = [{ role: 'user', content: userPrompt }];
  if (systemPrompt) {
    return [{ role: 'system', content: systemPrompt }, ...messages];
  }
  return messages;
}

function getRequestedModel(params, fallbackModel) {
  return params.model || fallbackModel;
}

function buildStages(family, params) {
  const requestedModel = params.model;
  const defaultAnthropicModel = getRequestedModel(params, CLAUDE_HAIKU_MODEL);

  if (family === 'deepseek') {
    return [
      {
        provider: 'deepseek',
        model: getRequestedModel(params, 'deepseek-chat'),
        keyEnv: 'DEEPSEEK_API_KEY',
        execute: async () => DeepSeek.chat({
          model: getRequestedModel(params, 'deepseek-chat'),
          messages: buildMessages(params.systemPrompt, params.userPrompt),
          temperature: params.temperature
        })
      },
      {
        provider: 'openrouter',
        model: 'deepseek/deepseek-chat',
        keyEnv: 'OPENROUTER_API_KEY',
        execute: async () => OpenRouter.chat({
          model: 'deepseek/deepseek-chat',
          messages: buildMessages(params.systemPrompt, params.userPrompt),
          temperature: params.temperature
        })
      },
      {
        provider: 'anthropic',
        model: CLAUDE_HAIKU_MODEL,
        keyEnv: 'ANTHROPIC_API_KEY',
        execute: async () => Anthropic.chat({
          model: CLAUDE_HAIKU_MODEL,
          messages: [{ role: 'user', content: params.userPrompt }],
          system: params.systemPrompt,
          max_tokens: params.maxTokens,
          temperature: params.temperature
        })
      }
    ];
  }

  if (family === 'qwen') {
    return [
      {
        provider: 'dashscope',
        model: requestedModel || process.env.DASHSCOPE_MODEL || 'qwen-turbo',
        keyEnv: 'DASHSCOPE_API_KEY',
        execute: async () => {
          const dashscope = new DashScopeProvider();
          const result = await dashscope.chat({
            model: requestedModel || process.env.DASHSCOPE_MODEL || 'qwen-turbo',
            messages: buildMessages(params.systemPrompt, params.userPrompt),
            temperature: params.temperature,
            maxTokens: params.maxTokens
          });

          if (!result || result.success === false) {
            const error = new Error(result && result.error ? result.error : 'DashScope request failed');
            throw error;
          }

          return { text: result.content || '' };
        }
      },
      {
        provider: 'openrouter',
        model: 'qwen/qwen-2.5-72b-instruct',
        keyEnv: 'OPENROUTER_API_KEY',
        execute: async () => OpenRouter.chat({
          model: 'qwen/qwen-2.5-72b-instruct',
          messages: buildMessages(params.systemPrompt, params.userPrompt),
          temperature: params.temperature
        })
      },
      {
        provider: 'anthropic',
        model: CLAUDE_HAIKU_MODEL,
        keyEnv: 'ANTHROPIC_API_KEY',
        execute: async () => Anthropic.chat({
          model: CLAUDE_HAIKU_MODEL,
          messages: [{ role: 'user', content: params.userPrompt }],
          system: params.systemPrompt,
          max_tokens: params.maxTokens,
          temperature: params.temperature
        })
      }
    ];
  }

  if (family === 'openai') {
    return [
      {
        provider: 'openai',
        model: getRequestedModel(params, 'gpt-4o-mini'),
        keyEnv: 'OPENAI_API_KEY',
        execute: async () => OpenAI.callOpenAI({
          model: getRequestedModel(params, 'gpt-4o-mini'),
          messages: [{ role: 'user', content: params.userPrompt }],
          system: params.systemPrompt,
          max_tokens: params.maxTokens,
          temperature: params.temperature
        })
      },
      {
        provider: 'openrouter',
        model: 'openai/gpt-4o-mini',
        keyEnv: 'OPENROUTER_API_KEY',
        execute: async () => OpenRouter.chat({
          model: 'openai/gpt-4o-mini',
          messages: buildMessages(params.systemPrompt, params.userPrompt),
          temperature: params.temperature
        })
      },
      {
        provider: 'anthropic',
        model: CLAUDE_HAIKU_MODEL,
        keyEnv: 'ANTHROPIC_API_KEY',
        execute: async () => Anthropic.chat({
          model: CLAUDE_HAIKU_MODEL,
          messages: [{ role: 'user', content: params.userPrompt }],
          system: params.systemPrompt,
          max_tokens: params.maxTokens,
          temperature: params.temperature
        })
      }
    ];
  }

  if (family === 'gemini') {
    return [
      {
        provider: 'gemini',
        model: getRequestedModel(params, 'gemini-2.0-flash'),
        keyEnv: 'GEMINI_API_KEY',
        execute: async () => Gemini.chat({
          model: getRequestedModel(params, 'gemini-2.0-flash'),
          messages: [{ role: 'user', content: params.userPrompt }],
          system: params.systemPrompt,
          temperature: params.temperature
        })
      },
      {
        provider: 'openrouter',
        model: 'google/gemini-2.0-flash-001',
        keyEnv: 'OPENROUTER_API_KEY',
        execute: async () => OpenRouter.chat({
          model: 'google/gemini-2.0-flash-001',
          messages: buildMessages(params.systemPrompt, params.userPrompt),
          temperature: params.temperature
        })
      },
      {
        provider: 'anthropic',
        model: CLAUDE_HAIKU_MODEL,
        keyEnv: 'ANTHROPIC_API_KEY',
        execute: async () => Anthropic.chat({
          model: CLAUDE_HAIKU_MODEL,
          messages: [{ role: 'user', content: params.userPrompt }],
          system: params.systemPrompt,
          max_tokens: params.maxTokens,
          temperature: params.temperature
        })
      }
    ];
  }

  return [
    {
      provider: 'anthropic',
      model: defaultAnthropicModel,
      keyEnv: 'ANTHROPIC_API_KEY',
      execute: async () => Anthropic.chat({
        model: defaultAnthropicModel,
        messages: [{ role: 'user', content: params.userPrompt }],
        system: params.systemPrompt,
        max_tokens: params.maxTokens,
        temperature: params.temperature
      })
    },
    {
      provider: 'openrouter',
      model: 'anthropic/claude-haiku-4-5',
      keyEnv: 'OPENROUTER_API_KEY',
      execute: async () => OpenRouter.chat({
        model: 'anthropic/claude-haiku-4-5',
        messages: buildMessages(params.systemPrompt, params.userPrompt),
        temperature: params.temperature
      })
    },
    {
      provider: 'openai',
      model: 'gpt-4o-mini',
      keyEnv: 'OPENAI_API_KEY',
      execute: async () => OpenAI.callOpenAI({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: params.userPrompt }],
        system: params.systemPrompt,
        max_tokens: params.maxTokens,
        temperature: params.temperature
      })
    }
  ];
}

async function executeStage(stage, context) {
  const providerName = stage.provider;
  let lastError;

  for (let attempt = 0; attempt < RETRY_DELAYS_MS.length; attempt += 1) {
    logger.info('router.call.attempt', {
      provider: providerName,
      model: stage.model,
      runId: context.runId,
      agent: context.agent,
      attempt: attempt + 1
    });

    try {
      const result = await stage.execute();
      const text = extractText(result);

      circuitBreaker.recordSuccess(providerName);
      logger.info('router.call.success', {
        provider: providerName,
        model: stage.model,
        runId: context.runId,
        agent: context.agent
      });

      const eb = _getBus();
      if (eb) {
        eb.push('llm.call.completed', {
          model: stage.model,
          provider: providerName,
          runId: context.runId || null,
          agent: context.agent || null,
          estimatedCostUSD: _estimateCost(providerName),
          ts: new Date().toISOString(),
        });
      }
      return text;
    } catch (error) {
      lastError = error;

      if (shouldRetry(error) && attempt < RETRY_DELAYS_MS.length - 1) {
        await sleep(RETRY_DELAYS_MS[attempt]);
        continue;
      }

      circuitBreaker.recordFailure(providerName);
      throw error;
    }
  }

  circuitBreaker.recordFailure(providerName);
  throw lastError || new Error(`Provider ${providerName} failed`);
}

async function call(options) {
  options = options || {};
  // Kostenbremse: Policy-Override aus Control Tower prüfen
  const _tower = _getTowerPolicy();
  if (_tower) {
    if (_tower.isAgentStopped()) {
      throw new Error('[Control Tower] Agent-Stop aktiv - alle LLM-Calls blockiert. Freigabe via DELETE /api/tower/policy/override');
    }
    const _lock = _tower.getModelLock();
    if (_lock && !options.model) options = { ...options, model: _lock };
    else if (_lock) options = { ...options, model: _lock };
  }
  const params = options || {};
  const family = detectFamily(params.model);
  const stages = buildStages(family, {
    model: params.model,
    systemPrompt: params.systemPrompt || '',
    userPrompt: params.userPrompt || '',
    maxTokens: typeof params.maxTokens === 'number' ? params.maxTokens : 1024,
    temperature: typeof params.temperature === 'number' ? params.temperature : 0.3
  });

  return queue.add(async () => {
    const tried = [];

    for (let index = 0; index < stages.length; index += 1) {
      const stage = stages[index];
      const nextStage = stages[index + 1];

      if (!process.env[stage.keyEnv]) {
        tried.push({
          provider: stage.provider,
          model: stage.model,
          reason: `missing_${stage.keyEnv}`
        });

        if (nextStage) {
          logger.warn('router.call.fallback', {
            from: stage.provider,
            to: nextStage.provider,
            reason: `missing_${stage.keyEnv}`,
            runId: params.runId,
            agent: params.agent
          });
        }
        continue;
      }

      if (circuitBreaker.isOpen(stage.provider)) {
        tried.push({
          provider: stage.provider,
          model: stage.model,
          reason: 'circuit_open'
        });

        if (nextStage) {
          logger.warn('router.call.fallback', {
            from: stage.provider,
            to: nextStage.provider,
            reason: 'circuit_open',
            runId: params.runId,
            agent: params.agent
          });
        }
        continue;
      }

      try {
        return await executeStage(stage, { runId: params.runId, agent: params.agent });
      } catch (error) {
        tried.push({
          provider: stage.provider,
          model: stage.model,
          reason: error.message
        });

        if (nextStage) {
          logger.warn('router.call.fallback', {
            from: stage.provider,
            to: nextStage.provider,
            reason: error.message,
            runId: params.runId,
            agent: params.agent
          });
          continue;
        }
      }
    }

    logger.error('router.call.exhausted', {
      tried,
      runId: params.runId,
      agent: params.agent,
      family
    });

    const error = new Error(`All LLM fallbacks exhausted for family "${family}"`);
    error.tried = tried;
    throw error;
  });
}

module.exports = { call };
