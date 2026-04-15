/**
 * (c) 2026 KI-OS.org (v6.0) by Ingo Schaffer und Kimba
 * Datei: gemini.provider.js
 * Diese Datei enthält JavaScript-Logik für Runtime, Services, Tools oder Tests innerhalb des KI-OS AgentMesh.
 */

'use strict';
const axios = require('../core/http.client');
const Observability = require('../core/observability.service');

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta';

/**
 * Standard Gemini (generateContent) – for chat / low-latency.
 */
async function callGemini(params) {
    const { messages, model, system, temperature } = params;

    // Mapping auf v1beta IDs
    let target = model;
    if (model && model.includes('3.0')) target = process.env.GEMINI_STANDARD_MODEL || 'gemini-3.1-pro';

    const contents = messages.map(m => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.content }]
    }));

    const systemInstruction = system ? { parts: [{ text: system }] } : undefined;

    try {
        const res = await axios.post(
            `${GEMINI_BASE}/models/${encodeURIComponent(target)}:generateContent`,
            {
                contents,
                ...(systemInstruction ? { system_instruction: systemInstruction } : {}),
                generationConfig: { temperature: typeof temperature === 'number' ? temperature : 0.7 }
            },
            { headers: { 'x-goog-api-key': process.env.GEMINI_API_KEY } }
        );

        const txt = res.data.candidates?.[0]?.content?.parts?.[0]?.text || '';

        Observability.recordProviderCall('google', { model: target, api: 'generateContent' });
        return {
            text: txt,
            reply: txt,
            meta: { provider: 'google', model: target, api: 'generateContent' }
        };
    } catch (e) {
        Observability.recordProviderFailure('google', e, { model: target, api: 'generateContent' });
        throw new Error(`Gemini Error: ${e.response?.data?.error?.message || e.message}`);
    }
}

/**
 * Gemini Deep Research Agent (Preview) – Interactions API
 * Docs: https://ai.google.dev/gemini-api/docs/deep-research
 *
 * REST:
 *  POST /v1beta/interactions { input, agent, background: true, store: true }
 *  GET  /v1beta/interactions/{id}
 */
async function deepResearch(params) {
    const query = params?.input || params?.query || params?.prompt;
    if (!query) throw new Error('Gemini Deep Research: missing query');

    if (!process.env.GEMINI_API_KEY) throw new Error('Gemini Deep Research: GEMINI_API_KEY missing');

    const agent = params.agent || process.env.GEMINI_DEEP_RESEARCH_MODEL || 'gemini-3.1-pro';
    const pollMs = Number(process.env.GEMINI_INTERACTIONS_POLL_MS || 10000);
    const maxMs = Number(process.env.GEMINI_INTERACTIONS_MAX_MS || 20 * 60 * 1000); // 20min default
    const startedAt = Date.now();

    // 1) create interaction (background execution requires store=true per docs)
    const createPayload = {
        input: query,
        agent,
        background: true,
        store: true
    };

    let interaction;
    try {
        const res = await axios.post(
            `${GEMINI_BASE}/interactions`,
            createPayload,
            {
                headers: {
                    'Content-Type': 'application/json',
                    'x-goog-api-key': process.env.GEMINI_API_KEY
                },
                timeout: 30000
            }
        );
        interaction = res.data;
    } catch (e) {
        throw new Error(`Gemini Deep Research create failed: ${e.response?.data?.error?.message || e.message}`);
    }

    const id = interaction?.id;
    if (!id) throw new Error('Gemini Deep Research: missing interaction.id');

    // 2) poll
    while (true) {
        if ((Date.now() - startedAt) > maxMs) {
            throw new Error(`Gemini Deep Research timeout after ${maxMs}ms (id=${id})`);
        }

        let cur;
        try {
            const res = await axios.get(
                `${GEMINI_BASE}/interactions/${encodeURIComponent(id)}`,
                {
                    headers: { 'x-goog-api-key': process.env.GEMINI_API_KEY },
                    timeout: 30000
                }
            );
            cur = res.data;
        } catch (e) {
            throw new Error(`Gemini Deep Research poll failed: ${e.response?.data?.error?.message || e.message}`);
        }

        const status = (cur?.status || '').toLowerCase();
        if (status === 'completed') {
            const outputs = cur.outputs || [];
            const last = outputs.length ? outputs[outputs.length - 1] : null;
            const text = last?.text || last?.content?.parts?.[0]?.text || '';
            return {
                id,
                status: 'completed',
                text,
                meta: {
                    provider: 'google',
                    api: 'interactions',
                    agent,
                    duration_ms: Date.now() - startedAt
                },
                raw: cur
            };
        }

        if (status === 'failed' || status === 'cancelled') {
            throw new Error(`Gemini Deep Research failed: ${cur?.error || status} (id=${id})`);
        }

        await new Promise(r => setTimeout(r, pollMs));
    }
}


function extractGeminiSources(responseData) {
    const candidates = Array.isArray(responseData?.candidates) ? responseData.candidates : [];
    const metadata = candidates[0]?.groundingMetadata || responseData?.groundingMetadata || {};
    const chunks = Array.isArray(metadata?.groundingChunks) ? metadata.groundingChunks : [];
    return chunks
        .map(chunk => ({
            title: chunk?.web?.title || chunk?.retrievedContext?.title || 'Source',
            url: chunk?.web?.uri || chunk?.retrievedContext?.uri || '',
            description: chunk?.web?.snippet || ''
        }))
        .filter(item => item.url);
}

async function webSearch({ query, model }) {
    const targetModel = model || process.env.GEMINI_RESEARCH_MODEL || process.env.GEMINI_STANDARD_MODEL || 'gemini-3-flash-preview';
    const payload = {
        contents: [{ parts: [{ text: query }] }],
        tools: [{ google_search: {} }]
    };

    const res = await axios.post(
        `${GEMINI_BASE}/models/${encodeURIComponent(targetModel)}:generateContent`,
        payload,
        {
            headers: {
                'x-goog-api-key': process.env.GEMINI_API_KEY,
                'Content-Type': 'application/json'
            },
            timeout: Number(process.env.WEBSEARCH_TIMEOUT_MS || 30000)
        }
    );

    const data = res.data || {};
    const answer = data.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('\n') || '';

    return {
        answer,
        citations: extractGeminiSources(data),
        sources: extractGeminiSources(data),
        raw: data
    };
}

module.exports = {
    chat: callGemini,
    callGemini, // Fix für Verifier
    deepResearch,
    webSearch
};
