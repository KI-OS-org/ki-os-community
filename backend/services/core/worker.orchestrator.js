/**
 * KI-OS Community Edition — Core Infrastructure
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: Apache License 2.0
 * SPDX-License-Identifier: Apache-2.0
 */
/**
 * (c) 2026 KI-OS.org (v1.6.0) by Ingo Schaffer und Kimba
 * Datei: worker.orchestrator.js
 * Diese Datei enthält JavaScript-Logik für Runtime, Services, Tools oder Tests innerhalb des KI-OS AgentMesh.
 * @license AGPL-3.0-only
 */

'use strict';
const WorkerTools = require('./worker.tools');
const WebSearch = require('../websearch.service');
const { resolveCapabilityRoute } = require('../providers/capability-router.service');
const Desktop = require('../desktop/desktop.service');
const Observability = require('./observability.service');
const { evaluateToolPolicy } = require('../governance/policy.engine');
const { evaluateSecurityInput } = require('../security/security.filter');
const { evaluatePrivacyInput } = require('../privacy/privacy.guard');
const { canExecute, recordFailure, recordSuccess } = require('../resilience/circuit-breaker.service');
const { enqueueDeadLetter } = require('../resilience/dlq.service');
const logger = require('./logger.service');

const Providers = {
    openai: require('../providers/openai.provider'),
    anthropic: require('../providers/anthropic.provider'),
    gemini: require('../providers/gemini.provider'),
    google: require('../providers/gemini.provider'),
    deepseek: require('../providers/deepseek.provider'),
    openrouter: require('../providers/openrouter.provider'),
    media: require('../providers/media.provider')
};

function getProviderName(model) {
    const value = String(model || '').toLowerCase();
    if (value.startsWith('openrouter/') || value.includes('mistral/') || value.includes('meta-llama/')) return 'openrouter';
    if (value.includes('gpt') || value.startsWith('o1') || value.startsWith('o3')) return 'openai';
    if (value.includes('claude')) return 'anthropic';
    if (value.includes('gemini') || value.includes('deep-research')) return 'google';
    if (value.includes('deepseek')) return 'deepseek';
    return 'openai';
}

function extractJSON(text) {
    try { return JSON.parse(text); } catch (e) {}
    let clean = String(text || '').replace(/```json/g, '').replace(/```/g, '').trim();
    try { return JSON.parse(clean); } catch (e) {}
    let firstOpen = clean.indexOf('{');
    let lastClose = clean.lastIndexOf('}');
    if (firstOpen >= 0 && lastClose > firstOpen) {
        try { return JSON.parse(clean.substring(firstOpen, lastClose + 1)); } catch (e) {}
    }
    return null;
}

function extractUrls(text) {
    const t = String(text || '');
    const re = /https?:\/\/[^\s)\]]+/g;
    const found = t.match(re) || [];
    const uniq = [];
    for (const u of found) {
        const clean = u.replace(/[.,;]+$/,'');
        if (!uniq.includes(clean)) uniq.push(clean);
    }
    return uniq.slice(0, 25);
}

function withTimeout(fn, ms = 30000) {
    return Promise.race([
        Promise.resolve().then(fn),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Provider timeout after ' + ms + 'ms')), ms))
    ]);
}

function urlsToSources(urls) {
    return (urls || []).map((u, i) => {
        let host = u;
        try { host = new URL(u).hostname; } catch {}
        return { id: i + 1, title: host, description: '', url: u };
    });
}

function estimateBudgetCents(task = {}) {
    const typeFactor = { research: 35, multi: 25, code: 18, excel: 14, ppt: 14, chat: 8, desktop: 4, media: 30 };
    const workerType = String(task.worker_type || 'chat').toLowerCase();
    const query = String(task.input_data?.query || '');
    const base = typeFactor[workerType] || 10;
    const textFactor = Math.min(20, Math.ceil(query.length / 250));
    const deepFactor = task.input_data?.deep_research ? 120 : 0;
    return base + textFactor + deepFactor;
}

function enforceProviderGovernance(task, phase, options = {}) {
    const provider = getProviderName(task.model);
    const policy = evaluateToolPolicy({
        tool: 'llm_invoke',
        action: phase,
        ctx: options.context || {},
        payload: {
            provider,
            model: task.model,
            budgetCents: Number(options.budgetCents || estimateBudgetCents(task))
        }
    });
    if (policy.decision === 'deny') {
        const error = new Error(`governance_denied:${policy.reason}`);
        error.statusCode = 403;
        error.failureClass = 'policy';
        throw error;
    }
    if (policy.decision === 'escalate') {
        const error = new Error(`approval_required:${policy.reason}`);
        error.statusCode = 403;
        error.failureClass = 'policy';
        throw error;
    }
    return { provider, policy };
}

async function runProviderCall(providerName, phase, invoke, meta = {}, options = {}) {
    canExecute(`provider:${providerName}`, { runId: options.runId });
    try {
        const res = await invoke();
        recordSuccess(`provider:${providerName}`);
        Observability.recordProviderCall(providerName, { phase, ...meta });
        return res;
    } catch (e) {
        recordFailure(`provider:${providerName}`, e);
        Observability.recordProviderFailure(providerName, e, { phase, ...meta });
        enqueueDeadLetter({ category: 'provider_call', reason: e.message, runId: options.runId || null, payload: { provider: providerName, phase, ...meta } });
        throw e;
    }
}

async function executeTask(task, repairInstruction = null, options = {}) {
    logger.info('orchestrator.execute', { workerType: task.worker_type, repair: !!repairInstruction, runId: options.runId || null });
    const security = evaluateSecurityInput({ text: task.input_data?.query || '', source: `worker.${task.worker_type}`, runId: options.runId || null, traceId: options.traceId || null });
    const privacy = evaluatePrivacyInput({ text: task.input_data?.query || '', source: `worker.${task.worker_type}`, runId: options.runId || null, traceId: options.traceId || null, autoMask: true });
    if (privacy.changed) {
        task = { ...task, input_data: { ...(task.input_data || {}), query: privacy.maskedText }, privacy: { piiTypes: privacy.detection.types, piiCount: privacy.detection.total } };
    }
    if (security.decision === 'block') {
        const error = new Error('security_filter_blocked');
        error.statusCode = 403;
        error.failureClass = 'policy';
        enqueueDeadLetter({ category: 'security', reason: 'worker_prompt_injection', runId: options.runId || null, payload: { workerType: task.worker_type, model: task.model } });
        throw error;
    }

    // MEDIA (Replicate)
    if (task.worker_type === 'media') {
        const res = await Providers.media.mediaImageRun('replicate', { input: { prompt: task.input_data.query } });
        return { status: 'success', output_type: 'media', output_data: JSON.stringify(res), sources: [] };
    }

    if (task.worker_type === 'desktop') {
        const input = task.input_data || {};
        let result;
        if (input.command === 'status') result = await Desktop.getDesktopStatus();
        else if (input.command === 'observe') result = await Desktop.observeDesktop(input);
        else if (input.command === 'screenshot') result = await Desktop.captureScreenshot(input);
        else if (input.command === 'stop') result = await Desktop.stopDesktopActions(input.reason || 'worker_stop');
        else if (input.command === 'lock') result = await Desktop.lockDesktopSession({ sessionId: input.sessionId, reason: input.reason });
        else if (input.command === 'unlock') result = await Desktop.unlockDesktopSession({ sessionId: input.sessionId });
        else result = await Desktop.performDesktopAction(input, { role: input.role || 'system' });
        return {
            status: result.success ? 'success' : 'error',
            output_type: 'desktop',
            output_data: JSON.stringify(result),
            draft_json: result,
            sources: [],
            metrics: { model: task.model, provider: 'desktop', worker_type: 'desktop' }
        };
    }

    let sources = [];
    let originalQuery = task.input_data.query;
    let systemPrompt = `You are a specialized worker: ${task.worker_type}.`;
    let userPrompt = originalQuery;

    const deepResearchSelected = task.worker_type === 'research' && task.input_data?.deep_research === true;

    if (task.worker_type === 'research' && !deepResearchSelected) {
        logger.info('orchestrator.research.websearch', { query: originalQuery.slice(0, 80) });
        const webRoute = await resolveCapabilityRoute('websearch', { query: originalQuery });
        const searchRes = await withTimeout(() => WebSearch.search(originalQuery, 5, { provider: webRoute.provider }), Number(process.env.WEBSEARCH_TIMEOUT_MS || 30000));
        sources = searchRes.sources || [];
        const contextText = sources.map((s, i) => `[${i + 1}] ${s.title}: ${s.description} (${s.url})`).join('\n\n');
        userPrompt = `QUERY: ${originalQuery}\n\nSOURCES:\n${contextText}\n\nTASK: Answer based on sources.`;
        systemPrompt += ' OUTPUT JSON: { "answer": "text with citations like [1]", "citations": [{"id": 1}] }. IDs must match source index.';
    } else if (task.worker_type === 'research' && deepResearchSelected) {
        logger.info('orchestrator.research.deep', { provider: 'gemini', query: originalQuery.slice(0, 80) });

        const researchStart = Date.now();
        const researchRoute = await resolveCapabilityRoute('research', { query: originalQuery });
        const researchProviderKey = (researchRoute.provider === 'google' ? 'gemini' : researchRoute.provider) || 'gemini';
        enforceProviderGovernance({ ...task, model: task.model || researchRoute.model }, 'deep_research', options);
        const geminiRes = await runProviderCall(
            researchProviderKey,
            'deep_research',
            () => withTimeout(() => Providers[researchProviderKey].deepResearch({ query: originalQuery, agent: task.model || researchRoute.model }), Number(process.env.GEMINI_DEEP_RESEARCH_TIMEOUT_MS || 180000)),
            { model: task.model || researchRoute.model },
            options
        );

        const reportText = geminiRes.text || '';
        const urls = extractUrls(reportText);
        sources = urlsToSources(urls);

        const verifierModel = process.env.ONEVOICE_RESEARCH_VERIFIER_MODEL || 'gpt-5.4';
        const verifierSystem = `You are KIMBA ONE-VOICE (Research Compiler).
Goal: produce a clean, executive-ready answer based on the research report.
Rules:
- Output ONLY JSON.
- Use citations in the answer as [1], [2], ... referencing the SOURCES list indices.
- If the report contains claims without a matching source URL, be explicit about uncertainty.`;

        const verifierUser = `USER QUERY:\n${originalQuery}\n\nRESEARCH REPORT (RAW):\n${reportText}\n\nSOURCES (derived from URLs in report):\n${sources.map((s,i)=>`[${i+1}] ${s.url}`).join('\n') || '(none)'}\n\nReturn JSON: { "answer": "...", "confidence": 0.0-1.0, "citations": [{"id":1}], "issues": ["..."] }`;

        let merged = null;
        try {
            enforceProviderGovernance({ ...task, model: verifierModel }, 'research_verifier', options);
            const v = await runProviderCall(
                'openai',
                'research_verifier',
                () => withTimeout(() => Providers.openai.callOpenAI({ model: verifierModel, messages: [{ role: 'user', content: verifierUser }], system: verifierSystem }), Number(process.env.OPENAI_TIMEOUT_MS || 30000)),
                { model: verifierModel },
                options
            );
            merged = extractJSON(v.text) || { answer: v.text, confidence: 0.5, citations: [] };
        } catch (e) {
            merged = { answer: reportText, confidence: 0.5, citations: [], issues: [`verifier_failed: ${e.message}`] };
        }

        const enableSecondary = (process.env.ONEVOICE_SECONDARY_DEEP_RESEARCH || 'false') === 'true';
        const low = Number(merged.confidence || 0.0) < Number(process.env.ONEVOICE_SECONDARY_DEEP_RESEARCH_MIN_CONF || 0.62);

        if (enableSecondary && low && Providers.openai.deepResearch) {
            logger.info('orchestrator.research.secondary', { provider: 'openai', confidence: merged.confidence });
            enforceProviderGovernance({ ...task, model: verifierModel }, 'secondary_deep_research', options);
            const oaRes = await runProviderCall(
                'openai',
                'secondary_deep_research',
                () => withTimeout(() => Providers.openai.deepResearch({ input: originalQuery }), Number(process.env.OPENAI_DEEP_RESEARCH_TIMEOUT_MS || 180000)),
                { model: verifierModel },
                options
            );

            const urls2 = extractUrls(oaRes.text || '');
            const sources2 = urlsToSources(urls2);
            const byUrl = new Set(sources.map(s => s.url));
            for (const s of sources2) {
                if (!byUrl.has(s.url) && sources.length < 40) {
                    sources.push({ id: sources.length + 1, title: s.title, description: '', url: s.url });
                    byUrl.add(s.url);
                }
            }

            const mergeSystem = `You are KIMBA ONE-VOICE (Research Merger).
Combine two research reports into one consistent answer with citations.
Return ONLY JSON: { "answer":"...", "confidence":0-1, "citations":[{"id":1}], "notes":["..."] }`;

            const mergeUser = `USER QUERY:\n${originalQuery}\n\nREPORT A (Gemini Deep Research):\n${reportText}\n\nREPORT B (OpenAI Deep Research):\n${oaRes.text || ''}\n\nSOURCES:\n${sources.map((s,i)=>`[${i+1}] ${s.url}`).join('\n') || '(none)'}\n\nReturn the merged JSON.`;
            enforceProviderGovernance({ ...task, model: verifierModel }, 'research_merge', options);
            const m = await runProviderCall(
                'openai',
                'research_merge',
                () => withTimeout(() => Providers.openai.callOpenAI({ model: verifierModel, messages: [{ role: 'user', content: mergeUser }], system: mergeSystem }), Number(process.env.OPENAI_TIMEOUT_MS || 30000)),
                { model: verifierModel },
                options
            );
            const merged2 = extractJSON(m.text);
            if (merged2 && merged2.answer) merged = merged2;
            merged.secondary_used = true;
        }

        return {
            status: 'success',
            output_type: 'research',
            output_data: merged.answer || reportText,
            draft_json: merged,
            sources,
            metrics: { model: task.model, provider: 'google', mode: 'deep_research' },
            meta: {
                research: {
                    mode: 'gemini_deep_research',
                    duration_ms: Date.now() - researchStart,
                    gemini: geminiRes.meta,
                    secondary_used: !!merged.secondary_used
                }
            }
        };
    } else if (task.worker_type === 'multi') {
        const plan = Array.isArray(task.input_data?.orchestration_plan) ? task.input_data.orchestration_plan : [];
        const results = [];
        for (const subTask of plan.slice(0, 5)) {
            const nestedTask = {
                ...task,
                worker_type: subTask.worker_type || 'chat',
                model: subTask.model || task.model,
                input_data: subTask.input_data || { query: task.input_data?.query || '' }
            };
            const nestedResult = await executeTask(nestedTask, repairInstruction, options);
            results.push({ worker_type: nestedTask.worker_type, result: nestedResult });
        }
        return {
            status: 'success',
            output_type: 'multi',
            output_data: JSON.stringify(results),
            draft_json: { results },
            sources: results.flatMap(r => r.result?.sources || []),
            metrics: { model: task.model, provider: 'multi' }
        };
    } else if (['excel', 'code', 'ppt'].includes(task.worker_type)) {
        systemPrompt += ' OUTPUT JSON ONLY. STRICT FORMAT.';
        if (task.worker_type === 'excel') systemPrompt += ' { sheets: [{name, data}] }';
        if (task.worker_type === 'code') systemPrompt += ' { files: [{path, content}] }';
        if (task.worker_type === 'ppt') systemPrompt += ' { slides: [{title, text}] }';
    } else {
        systemPrompt += ' OUTPUT JSON: { "answer": "text", "confidence": 0.0-1.0 }.';
    }

    if (repairInstruction) {
        userPrompt += `\n\n[SYSTEM INSTRUCTION]: Previous attempt failed. REASON: ${repairInstruction}\nCORRECT IT NOW.`;
    }

    const providerName = getProviderName(task.model);
    const provider = Providers[providerName];
    if (!provider) throw new Error(`Provider for ${task.model} not found`);

    enforceProviderGovernance(task, 'dispatch', options);
    const messages = [{ role: 'user', content: userPrompt }];
    const res = await runProviderCall(
        providerName,
        'dispatch',
        () => withTimeout(() => (provider.chat || provider.callOpenAI || provider.callGemini)({ model: task.model, messages, system: systemPrompt }), Number(process.env.PROVIDER_TIMEOUT_MS || 30000)),
        { model: task.model, worker_type: task.worker_type },
        options
    );

    const text = res.text || res.reply || '';
    const json = extractJSON(text);
    const outputType = task.worker_type;

    let processedData = text;
    let file = {};
    if (json) {
        if (task.worker_type === 'excel') {
            const result = await WorkerTools.generateExcel(json);
            if (result.success) file = { file_base64: result.base64, file_mime: result.mime, file_name: result.filename };
        }
        if (task.worker_type === 'code') {
            const result = WorkerTools.generateCodeZip(json);
            if (result.success) file = { file_base64: result.base64, file_mime: result.mime, file_name: result.filename };
        }
        if (task.worker_type === 'ppt') {
            const result = await WorkerTools.generatePpt(json);
            if (result.success) file = { file_base64: result.base64, file_mime: result.mime, file_name: result.filename };
        }
        processedData = json.answer || json.content || json.text || JSON.stringify(json);
    }

    return {
        status: 'success',
        output_type: outputType,
        output_data: processedData,
        draft_json: json,
        ...file,
        sources,
        metrics: { model: task.model, provider: providerName }
    };
}

module.exports = { executeTask, estimateBudgetCents, enforceProviderGovernance };
