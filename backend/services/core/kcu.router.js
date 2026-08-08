/**
 * KI-OS Community Edition — Core Infrastructure
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: Apache License 2.0
 * SPDX-License-Identifier: Apache-2.0
 */
/**
 * (c) 2026 KI-OS.org (v1.6.0) by Ingo Schaffer und Kimba
 * Datei: kcu.router.js
 * Diese Datei enthält JavaScript-Logik für Runtime, Services, Tools oder Tests innerhalb des KI-OS AgentMesh.
 * @license AGPL-3.0-only
 */

'use strict';
const { v4: uuidv4 } = require('uuid');
const { getWorker } = require('./worker.registry');
const Reputation = require('./reputation.service');
const { scoreCandidate, getConfig } = require('../router.policy');
const OpenAI = require('../providers/openai.provider');
const { resolveDynamicRoute } = require('../routing/dynamic-routing.service');
const routingLog = require('./routing-decision.log');

// Model Metadata — aktueller Stand 2026-07-26 (siehe reference_model_scorecard)
const MODEL_META = {
    // OpenAI
    'gpt-5.6-sol': { cost_cpm: 5.0, p95_ms: 900 },
    // Anthropic
    'claude-opus-5': { cost_cpm: 5.0, p95_ms: 3000 },
    'claude-sonnet-5': { cost_cpm: 3.0, p95_ms: 1400 },
    'claude-haiku-4-5-20251001': { cost_cpm: 0.8, p95_ms: 700 },
    // Google
    'gemini-3.1-pro': { cost_cpm: 2.0, p95_ms: 1000 },
    'gemini-3.6-flash': { cost_cpm: 1.5, p95_ms: 400 },
    'gemini-deep-research': { cost_cpm: 3.0, p95_ms: 120000 },
    // DeepSeek (günstig)
    'deepseek-chat': { cost_cpm: 0.2, p95_ms: 500 },
    'deepseek-reasoner': { cost_cpm: 0.6, p95_ms: 2000 }
};

function hasExplicitDeepResearchTrigger(text) {
    const t = (text || '').toLowerCase();
    return /\bdeep\s*research\b|\bdeep-research\b|\btiefenrecherche\b|\bdeepresearch\b/.test(t);
}

function normalizeIntent(req) {
    const text = (req.input_text || '').toLowerCase();
    if (req.intent && req.intent !== 'auto') return req.intent;
    if (req.input_attachments?.some(a => a.type === 'xlsx')) return 'excel';
    if (text.includes('excel') || text.includes('tabelle')) return 'excel';
    if (text.includes('code') || text.includes('programmier')) return 'code';
    if (text.includes('bild') || text.includes('generiere')) return 'media';
    if (text.includes('suche') || text.includes('recherch') || text.includes('google')) return 'research';
    return 'chat';
}

function safeExtractJSON(text) {
    if (!text) return null;
    try { return JSON.parse(text); } catch {}
    const clean = String(text).replace(/```json/g, '').replace(/```/g, '').trim();
    try { return JSON.parse(clean); } catch {}
    const a = clean.indexOf('{');
    const b = clean.lastIndexOf('}');
    if (a >= 0 && b > a) {
        try { return JSON.parse(clean.slice(a, b + 1)); } catch {}
    }
    return null;
}

/**
 * ONE VOICE: Decide whether to run Deep Research for this query.
 * - If user explicitly asked => true
 * - Else: cheap model classification => true/false
 */
async function oneVoiceDecideDeepResearch(inputText) {
    const explicit = hasExplicitDeepResearchTrigger(inputText);
    if (explicit) return { deep_research: true, reason: 'explicit_trigger', confidence: 1.0 };

    const enabled = (process.env.ONEVOICE_DEEP_RESEARCH_ROUTER || 'true') === 'true';
    if (!enabled) return { deep_research: false, reason: 'router_disabled', confidence: 1.0 };

    // If no OpenAI key, fall back to heuristic only
    if (!process.env.OPENAI_API_KEY) {
        const heuristic = /\bvergleich\b|\banalyse\b|\bmarkt\b|\bdue\s*diligence\b|\bstrategie\b|\breport\b|\bquellen\b|\bzitier\b/.test((inputText||'').toLowerCase());
        return { deep_research: heuristic, reason: 'heuristic_no_openai', confidence: heuristic ? 0.6 : 0.55 };
    }

    const model = process.env.ONEVOICE_DEEP_RESEARCH_ROUTER_MODEL || 'gemini-3.6-flash'; // günstigstes Modell für Routing-Klassifikation
    const sys = `You are KIMBA ONE-VOICE ROUTER.
Decide if a user query requires a LONG-RUNNING deep research agent (minutes, multi-step web reading) or standard research (seconds, normal web search summarization).

Return ONLY JSON:
{
  "deep_research": true|false,
  "confidence": 0.0-1.0,
  "reason": "short"
}

Deep research TRUE when:
- user asks for deep research/tiefenrecherche, due diligence, market landscaping, comprehensive report, many sources
- comparing multiple vendors/approaches with citations
- tasks that benefit from iterative browsing/reading

Deep research FALSE when:
- quick factual lookup
- small summary
- simple definition`;

    const user = `QUERY:\n${inputText}`;
    const res = await (OpenAI.callOpenAI || OpenAI.chat)({ model, messages: [{ role: 'user', content: user }], system: sys, temperature: 0.0 });
    const parsed = safeExtractJSON(res.text);
    if (!parsed || typeof parsed.deep_research !== 'boolean') {
        // safe fallback
        return { deep_research: false, reason: 'router_parse_fail', confidence: 0.5 };
    }
    return {
        deep_research: !!parsed.deep_research,
        confidence: Math.max(0, Math.min(1, Number(parsed.confidence || 0.6))),
        reason: String(parsed.reason || 'router')
    };
}

async function routeJob(jobRequest) {
    const intent = normalizeIntent(jobRequest);
    const workerDef = getWorker(intent);
    await getConfig(); // Policy refresh

    const inputText = jobRequest.input_text || '';
    const explicitDeep = hasExplicitDeepResearchTrigger(inputText);

    // Decide deep research only for research worker
    let deepDecision = { deep_research: false, confidence: 0.0, reason: 'n/a' };
    if (workerDef.worker_type === 'research') {
        deepDecision = await oneVoiceDecideDeepResearch(inputText);
    }

    const candidates = [...workerDef.preferred_models, ...workerDef.fallback_models];

    let bestModel = null;
    let bestScore = -Infinity;
    let routingDecision = null;

    if (workerDef.worker_type === 'research' && deepDecision.deep_research) {
        bestModel = process.env.GEMINI_DEEP_RESEARCH_MODEL || 'gemini-3.1-pro';
        bestScore = 1.0;
    } else {
        routingDecision = await resolveDynamicRoute({
            query: inputText,
            intent: workerDef.worker_type === 'chat' ? 'default' : workerDef.worker_type,
            taskType: workerDef.worker_type
        }, {
            outcomeCoverage: Number(jobRequest.outcomeCoverage || 0),
            runId: jobRequest.runId || null
        });
        if (routingDecision?.selected?.model && candidates.includes(routingDecision.selected.model)) {
            bestModel = routingDecision.selected.model;
            bestScore = Number(routingDecision.selected.score || 0.8);
        } else {
            for (const model of candidates) {
                const meta = MODEL_META[model] || { cost_cpm: 1.0, p95_ms: 1000 };
                const rep = await Reputation.getModelReputation(model);
                const result = scoreCandidate({ meta }, rep.score || 0.6, []);
                const finalScore = result.score;
                if (Number.isFinite(finalScore) && finalScore > bestScore) {
                    bestScore = finalScore;
                    bestModel = model;
                }
            }
        }
        if (!bestModel) bestModel = candidates[0];
    }

    routingLog.record({ runId: jobRequest.job_id, model: bestModel, provider: routingDecision?.selected?.provider || null, reason: `intent:${intent} score:${bestScore}`, userId: jobRequest.userId });

    return {
        success: true,
        routing: {
            intent,
            worker_type: workerDef.worker_type,
            model: bestModel,
            score: bestScore,
            provider: routingDecision?.selected?.provider || null,
            dynamic_route: routingDecision,
            deep_research: {
                requested: explicitDeep,
                selected: !!deepDecision.deep_research,
                confidence: deepDecision.confidence,
                reason: deepDecision.reason
            }
        },
        workerTask: {
            task_id: uuidv4(),
            job_id: jobRequest.job_id,
            worker_type: workerDef.worker_type,
            model: bestModel,
            input_data: {
                query: jobRequest.input_text,
                deep_research: !!deepDecision.deep_research,
                deep_research_requested: explicitDeep
            },
            constraints: {}
        }
    };
}

module.exports = { routeJob };
