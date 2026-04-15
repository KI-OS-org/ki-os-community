/**
 * (c) 2026 KI-OS.org (v6.0) by Ingo Schaffer und Kimba
 * Datei: voice.service.js
 * Diese Datei enthält JavaScript-Logik für Runtime, Services, Tools oder Tests innerhalb des KI-OS AgentMesh.
 */

'use strict';
const OpenAI = require('./providers/openai.provider');

module.exports = {
    async compileResponse({ draft, context, verification, query, routing, sources }) {
        const profile = context.profile || {};
        const prefs = profile.preferences || {};
        const memories = context.memories || [];
        
        const memBlock = memories.length > 0 ? `MEMORY:\n${memories.map(m=>'- '+m.content).join('\n')}` : '';
        const srcContext = (sources && sources.length > 0) ? `SOURCES:\n${sources.map((s,i)=>`[${i+1}] ${s.title} (${s.url})`).join('\n')}` : '';

        let contentInput = '';
        if (draft.draft_json && draft.draft_json.citations) {
            contentInput = `DRAFT ANSWER:\n${draft.draft_json.answer}\n\nUSED CITATION IDS:\n${JSON.stringify(draft.draft_json.citations.map(c=>c.id))}`;
        } else {
            contentInput = typeof draft.output_data === 'string' ? draft.output_data : JSON.stringify(draft.output_data);
        }

        const systemPrompt = `You are KIMBA ONE-VOICE.
        
        IDENTITY:
        - Tone: ${prefs.formality || 'Professional'}
        - Language: ${prefs.language || 'DE'}
        
        ${memBlock}
        ${srcContext}
        
        VERIFIER NOTE: ${verification.rationale || 'None'}
        
        TASK:
        Synthesize the RAW DRAFT into a clear text.
        - Reference sources using [1], [2] notation inline.
        - DO NOT append a generated source list.
        - Be concise.
        
        RAW DRAFT:
        ${contentInput.substring(0, 15000)}`;

        try {
            const res = await OpenAI.chat({
                messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: "Compile." }],
                model: process.env.ONEVOICE_COMPILER_MODEL || 'gpt-5.4',
                temperature: 0.5
            });
            
            // FIX 3: KEIN manuelles Anhängen der Quellenliste.
            // Der Client (Frontend) nutzt meta.sources zur Anzeige.
            return { content: res.text, meta: { compiler: 'active' } };
        } catch (e) {
            return { content: draft.output_data, meta: { compiler: 'failed', error: e.message } };
        }
    }
};