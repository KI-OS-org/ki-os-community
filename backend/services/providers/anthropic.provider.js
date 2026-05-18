/**
 * KI-OS Community Edition — Core Infrastructure
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: Apache License 2.0
 * SPDX-License-Identifier: Apache-2.0
 */
/**
 * (c) 2026 KI-OS.org (v1.6.0) by Ingo Schaffer und Kimba
 * Datei: anthropic.provider.js
 * Diese Datei enthält JavaScript-Logik für Runtime, Services, Tools oder Tests innerhalb des KI-OS AgentMesh.
 * @license AGPL-3.0-only
 */

'use strict';
const axios = require('../core/http.client');
const Observability = require('../core/observability.service');

async function callAnthropic(params) {
    const { messages, model, temperature, max_tokens, system } = params;
    
    // Mapping auf aktuelle IDs
    let target = model;
    if (model === 'claude-opus-4.5') target = 'claude-opus-4-5-20251101';
    if (model === 'claude-sonnet-4.5') target = 'claude-sonnet-4-6';
    if (model === 'claude-4.5') target = 'claude-sonnet-4-6';

    // System Prompt Extraktion falls nicht explizit
    const sysMsg = system || messages.find(m=>m.role==='system')?.content || '';
    const userMsgs = messages.filter(m=>m.role!=='system');

    try {
    const res = await axios.post('https://api.anthropic.com/v1/messages', 
        { 
            model: target, 
            messages: userMsgs, 
            system: sysMsg, 
            max_tokens: max_tokens || 4096, 
            temperature: temperature || 0.7 
        }, 
        { 
            headers: { 
                'x-api-key': process.env.ANTHROPIC_API_KEY, 
                'anthropic-version': '2023-06-01', 
                'content-type': 'application/json' 
            } 
        }
    );

    Observability.recordProviderCall('anthropic', { model: target, api: 'messages' });
    return { 
        text: res.data.content[0].text, 
        reply: res.data.content[0].text, 
        meta: { provider: 'anthropic', model: target, usage: res.data.usage } 
    };
    } catch (e) {
      Observability.recordProviderFailure('anthropic', e, { model: target, api: 'messages' });
      throw e;
    }
}



function extractAnthropicSources(responseData) {
    const textBlocks = Array.isArray(responseData?.content) ? responseData.content : [];
    const sources = [];
    for (const block of textBlocks) {
        const citations = Array.isArray(block?.citations) ? block.citations : [];
        for (const citation of citations) {
            const url = citation?.url || citation?.source?.url;
            if (!url) continue;
            sources.push({
                title: citation?.title || citation?.source?.title || 'Source',
                url,
                description: citation?.snippet || citation?.source?.snippet || ''
            });
        }
    }
    return sources;
}

async function webSearch({ query, count = 5, model }) {
    const targetModel = model || process.env.ANTHROPIC_RESEARCH_MODEL || process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';
    const payload = {
        model: targetModel,
        max_tokens: Number(process.env.ANTHROPIC_MAX_TOKENS || 4096),
        messages: [{ role: 'user', content: query }],
        tools: [{
            type: 'web_search_20260209',
            name: 'web_search',
            max_uses: Math.max(1, Math.min(Number(count || 5), 10))
        }]
    };

    const res = await axios.post(
        'https://api.anthropic.com/v1/messages',
        payload,
        {
            headers: {
                'x-api-key': process.env.ANTHROPIC_API_KEY,
                'anthropic-version': process.env.ANTHROPIC_VERSION || '2023-06-01',
                'content-type': 'application/json'
            },
            timeout: Number(process.env.WEBSEARCH_TIMEOUT_MS || 30000)
        }
    );

    const data = res.data || {};
    const answer = (Array.isArray(data.content) ? data.content : [])
        .filter(block => block?.type === 'text')
        .map(block => block.text || '')
        .join('\n');

    return {
        answer,
        citations: extractAnthropicSources(data),
        sources: extractAnthropicSources(data),
        raw: data
    };
}

module.exports = {
    chat: callAnthropic,
    callAnthropic, // Fix für Verifier
    webSearch
};