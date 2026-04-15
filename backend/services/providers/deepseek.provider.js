/**
 * (c) 2026 KI-OS.org (v6.0) by Ingo Schaffer und Kimba
 * Datei: deepseek.provider.js
 * Diese Datei enthält JavaScript-Logik für Runtime, Services, Tools oder Tests innerhalb des KI-OS AgentMesh.
 */

'use strict';
const axios = require('../core/http.client');
const Observability = require('../core/observability.service');

async function callDeepseek(params) {
    const { messages, model, temperature } = params;
    const target = model === 'deepseek-reasoner' ? 'deepseek-reasoner' : 'deepseek-chat';

    try {
        const res = await axios.post('https://api.deepseek.com/v1/chat/completions',
            { model: target, messages, temperature: temperature || 0.0 },
            { headers: { 'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}` } }
        );

        Observability.recordProviderCall('deepseek', { model: target, api: 'chat.completions' });
        return {
            text: res.data.choices[0].message.content,
            reply: res.data.choices[0].message.content,
            meta: { provider: 'deepseek', model: target }
        };
    } catch (e) {
        Observability.recordProviderFailure('deepseek', e, { model: target, api: 'chat.completions' });
        throw e;
    }
}

module.exports = {
    chat: callDeepseek,
    callDeepseek // Fix für Verifier
};
