/**
 * @file    openrouter.provider.js
 * @desc    HTTP-Client für OpenRouter API — Chat Completions, Web Search, Streaming.
 *          Unterstützt alle OpenRouter-Modelle inkl. optionalem response_format (JSON Enforcement).
 * @author  Ingo Schaffer <ingo@ki-os.org>
 * @coauthor Kimba <kimba@ki-os.org>
 * @license AGPL-3.0-only — https://www.gnu.org/licenses/agpl-3.0.html
 */

'use strict';
const axios = require('../core/http.client');
const Observability = require('../core/observability.service');

async function chat({ messages, model, temperature, response_format }) {
    try {
        const payload = { model, messages, temperature };
        // response_format: { type: 'json_object' } erzwingt valides JSON (nicht alle Modelle supporten json_schema)
        if (response_format) payload.response_format = response_format;

        const res = await axios.post('https://openrouter.ai/api/v1/chat/completions',
            payload,
            { headers: { 'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}` } }
        );
        Observability.recordProviderCall('openrouter', { model, api: 'chat.completions' });
        return { text: res.data.choices[0].message.content, meta: { provider: 'openrouter', model } };
    } catch (e) {
        Observability.recordProviderFailure('openrouter', e, { model, api: 'chat.completions' });
        throw e;
    }
}

function extractOpenRouterSources(data) {
    const annotations = data?.choices?.[0]?.message?.annotations || [];
    return annotations
        .filter(item => item?.type === 'url_citation' && item?.url_citation?.url)
        .map(item => ({
            title: item.url_citation.title || 'Source',
            url: item.url_citation.url,
            description: item.url_citation.content || ''
        }));
}

async function webSearch({ query, count = 5, model }) {
    const targetModel = model || process.env.OPENROUTER_RESEARCH_MODEL || process.env.OPENROUTER_MODEL || 'openrouter/auto';
    const onlineModel = String(targetModel).includes(':online') ? targetModel : `${targetModel}:online`;
    const payload = {
        model: onlineModel,
        messages: [{ role: 'user', content: query }],
        plugins: [{ id: 'web', max_results: Math.max(1, Math.min(Number(count || 5), 10)) }]
    };

    try {
        const res = await axios.post(
            `${process.env.OPENROUTER_API_BASE || 'https://openrouter.ai/api/v1'}/chat/completions`,
            payload,
            {
                headers: {
                    'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                timeout: Number(process.env.WEBSEARCH_TIMEOUT_MS || 30000)
            }
        );

        Observability.recordProviderCall('openrouter', { model: onlineModel, api: 'chat.completions', capability: 'web_search' });
        const data = res.data || {};
        const answer = data.choices?.[0]?.message?.content || '';
        return {
            answer,
            citations: extractOpenRouterSources(data),
            sources: extractOpenRouterSources(data),
            raw: data
        };
    } catch (e) {
        Observability.recordProviderFailure('openrouter', e, { model: onlineModel, api: 'chat.completions', capability: 'web_search' });
        throw e;
    }
}

module.exports = {
    chat,
    webSearch
};
