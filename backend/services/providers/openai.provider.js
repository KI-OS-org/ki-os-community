/**
 * KI-OS Community Edition — Core Infrastructure
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: Apache License 2.0
 * SPDX-License-Identifier: Apache-2.0
 */
/**
 * (c) 2026 KI-OS.org (v1.6.0) by Ingo Schaffer und Kimba
 * Datei: openai.provider.js
 * Diese Datei enthält JavaScript-Logik für Runtime, Services, Tools oder Tests innerhalb des KI-OS AgentMesh.
 * @license AGPL-3.0-only
 */

'use strict';
const axios = require('../core/http.client');
const Observability = require('../core/observability.service');
const Telemetry = require('../core/system-view.service');

function mergeSystemMessage(messages, system) {
    if (!system) return messages;
    if (messages.find(m => m.role === 'system')) return messages;
    return [{ role: 'system', content: system }, ...messages];
}

async function callOpenAI(params) {
    const { messages, model, temperature, max_tokens, system, response_format } = params;

    if (model && (model.startsWith('o1') || model.startsWith('o3'))) return callReasoningModel({ ...params, system });
    if (model && model === 'gpt-5.4-responses') return callResponsesAPI(params); // explizite Opt-in nur bei bekanntem ID

    const finalMessages = mergeSystemMessage(messages, system);
    const payload = { model, messages: finalMessages };
    if (typeof temperature === 'number') payload.temperature = temperature;
    if (max_tokens) payload.max_tokens = max_tokens;
    if (response_format) payload.response_format = response_format;

    try {
        const res = await axios.post(
            'https://api.openai.com/v1/chat/completions',
            payload,
            { headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` } }
        );
        Observability.recordProviderCall('openai', { model, api: 'chat.completions' });
        return { text: res.data.choices[0].message.content, meta: { provider: 'openai', model, usage: res.data.usage, api: 'chat.completions' } };
    } catch (e) {
        Observability.recordProviderFailure('openai', e, { model, api: 'chat.completions' });
        throw new Error(`OpenAI Error: ${e.response?.data?.error?.message || e.message}`);
    }
}

async function callReasoningModel({ messages, model, max_tokens, system }) {
    let cleanMessages = messages.filter(m => m.role !== 'system');
    let effectiveSystem = system || messages.find(m => m.role === 'system')?.content;

    if (effectiveSystem) {
        if (cleanMessages.length > 0 && cleanMessages[0].role === 'user') {
            cleanMessages[0].content = `[INSTRUCTION]: ${effectiveSystem}\n\n[QUERY]: ${cleanMessages[0].content}`;
        } else {
            cleanMessages.unshift({ role: 'user', content: `[INSTRUCTION]: ${effectiveSystem}` });
        }
    }

    const payload = { model, messages: cleanMessages };
    if (max_tokens) payload.max_completion_tokens = max_tokens;

    try {
        const res = await axios.post(
            'https://api.openai.com/v1/chat/completions',
            payload,
            { headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` } }
        );
        Observability.recordProviderCall('openai', { model, api: 'chat.completions', mode: 'reasoning' });
        return { text: res.data.choices[0].message.content, meta: { provider: 'openai', model, mode: 'reasoning', api: 'chat.completions' } };
    } catch (e) {
        Observability.recordProviderFailure('openai', e, { model, api: 'chat.completions', mode: 'reasoning' });
        throw new Error(`Reasoning Error: ${e.response?.data?.error?.message || e.message}`);
    }
}

async function callResponsesAPI(params) {
    const finalMessages = mergeSystemMessage(params.messages, params.system);
    try {
        const res = await axios.post(
            'https://api.openai.com/v1/responses',
            { model: params.model, input: finalMessages, response_format: { type: 'text' } },
            { headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` } }
        );

        const txt = res.data.output_text
            || res.data.output?.[0]?.content?.find(c => c.type === 'output_text')?.text
            || res.data.choices?.[0]?.message?.content
            || '';

        return { text: txt, meta: { provider: 'openai', api: 'responses', model: params.model } };
    } catch (e) {
        Telemetry.logEvent('fallback', { from: params.model, to: 'gpt-5.4', reason: e.message });
        const fallback = await callOpenAI({ ...params, model: 'gpt-5.4' });
        fallback.meta.fallback_triggered = true;
        return fallback;
    }
}

/**
 * Low-level Responses call supporting tools/background for Deep Research.
 */
async function createResponse(payload) {
    try {
        const res = await axios.post(
            'https://api.openai.com/v1/responses',
            payload,
            { headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` }, timeout: 60000 }
        );
        return res.data;
    } catch (e) {
        throw new Error(`OpenAI responses.create failed: ${e.response?.data?.error?.message || e.message}`);
    }
}

async function getResponse(id) {
    try {
        const res = await axios.get(
            `https://api.openai.com/v1/responses/${encodeURIComponent(id)}`,
            { headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` }, timeout: 60000 }
        );
        return res.data;
    } catch (e) {
        throw new Error(`OpenAI responses.get failed: ${e.response?.data?.error?.message || e.message}`);
    }
}

/**
 * OpenAI Deep Research via Responses API + web_search_preview tool.
 * Docs: https://platform.openai.com/docs/guides/deep-research
 */
async function deepResearch({ input, query, prompt, model, poll_ms, max_ms }) {
    const text = input || query || prompt;
    if (!text) throw new Error('OpenAI Deep Research: missing input');
    if (!process.env.OPENAI_API_KEY) throw new Error('OpenAI Deep Research: OPENAI_API_KEY missing');

    const m = model || process.env.OPENAI_DEEP_RESEARCH_MODEL || 'o4-mini-deep-research';
    const pollMs = Number(poll_ms || process.env.OPENAI_DEEP_RESEARCH_POLL_MS || 10000);
    const maxMs = Number(max_ms || process.env.OPENAI_DEEP_RESEARCH_MAX_MS || 20 * 60 * 1000);
    const startedAt = Date.now();

    const created = await createResponse({
        model: m,
        input: text,
        background: true,
        tools: [{ type: 'web_search_preview' }],
        reasoning: { summary: 'auto' }
    });

    const id = created.id;
    if (!id) throw new Error('OpenAI Deep Research: missing response.id');

    while (true) {
        if ((Date.now() - startedAt) > maxMs) {
            throw new Error(`OpenAI Deep Research timeout after ${maxMs}ms (id=${id})`);
        }

        const cur = await getResponse(id);
        const status = (cur.status || '').toLowerCase();

        if (status === 'completed') {
            const txt = cur.output_text
                || cur.output?.[0]?.content?.find(c => c.type === 'output_text')?.text
                || '';
            return {
                id,
                status: 'completed',
                text: txt,
                meta: { provider: 'openai', api: 'responses', model: m, duration_ms: Date.now() - startedAt },
                raw: cur
            };
        }

        if (status === 'failed' || status === 'cancelled') {
            throw new Error(`OpenAI Deep Research failed: ${cur.error?.message || status} (id=${id})`);
        }

        await new Promise(r => setTimeout(r, pollMs));
    }
}



function extractOpenAISources(responseData) {
    const annotations = responseData?.output?.flatMap(item => item?.content || []).flatMap(content => content?.annotations || []) || [];
    return annotations
        .filter(item => item?.type === 'url_citation' && item?.url_citation?.url)
        .map(item => ({
            title: item.url_citation.title || 'Source',
            url: item.url_citation.url,
            description: item.url_citation.content || ''
        }));
}

async function webSearch({ query, count = 5, model }) {
    const targetModel = model || process.env.OPENAI_RESEARCH_MODEL || process.env.OPENAI_MODEL || 'gpt-5.4';
    const payload = {
        model: targetModel,
        input: query,
        tools: [{
            type: 'web_search',
            search_context_size: count >= 8 ? 'high' : count >= 4 ? 'medium' : 'low'
        }]
    };

    const res = await axios.post(
        'https://api.openai.com/v1/responses',
        payload,
        {
            headers: {
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                'Content-Type': 'application/json'
            },
            timeout: Number(process.env.WEBSEARCH_TIMEOUT_MS || 30000)
        }
    );

    const data = res.data || {};
    const answer = data.output_text
        || data.output?.[0]?.content?.find(c => c.type === 'output_text')?.text
        || '';

    return {
        answer,
        citations: extractOpenAISources(data),
        sources: extractOpenAISources(data),
        raw: data
    };
}

module.exports = {
    chat: callOpenAI,
    callOpenAI,
    deepResearch,
    webSearch
};
