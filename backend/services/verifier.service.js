/**
 * (c) 2026 KI-OS.org (v6.0) by Ingo Schaffer und Kimba
 * Datei: verifier.service.js
 * Diese Datei enthält JavaScript-Logik für Runtime, Services, Tools oder Tests innerhalb des KI-OS AgentMesh.
 */

'use strict';
const TRUST_GATE_PERCENT = Number(process.env.ROUTER_TRUST_GATE_PERCENT || 65);
if (TRUST_GATE_PERCENT < 0 || TRUST_GATE_PERCENT > 100) {
    throw new Error('ROUTER_TRUST_GATE_PERCENT must be 0-100, got: ' + TRUST_GATE_PERCENT);
}

const safeReq = (path) => { try { return require(path); } catch { return null; } };
const OA = safeReq('./providers/openai.provider');
const AN = safeReq('./providers/anthropic.provider');
const GE = safeReq('./providers/gemini.provider');

async function callOneVerifier(providerName, prompt) {
    try {
        const msgs = [{role:'system', content: prompt.system}, {role:'user', content: prompt.user}];
        const opts = { model: '', messages: msgs, temperature: 0.0 };
        
        if (providerName === 'openai' && process.env.OPENAI_API_KEY) {
            opts.model = process.env.VERIFIER_OPENAI_MODEL || 'gpt-5.4';
            return await (OA.callOpenAI || OA.chat)(opts);
        }
        if (providerName === 'anthropic' && process.env.ANTHROPIC_API_KEY) {
            opts.model = process.env.VERIFIER_ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001';
            return await (AN.callAnthropic || AN.chat)(opts);
        }
        if (providerName === 'gemini' && process.env.GEMINI_API_KEY) {
            opts.model = 'gemini-2.0-flash';
            return await (GE.callGemini || GE.chat)(opts);
        }
    } catch(e) { return null; }
    return null;
}

async function verifyAnswer({ answer, sources = [] }) {
    const committee = [];
    if(process.env.OPENAI_API_KEY) committee.push('openai');
    if(process.env.ANTHROPIC_API_KEY) committee.push('anthropic');
    if(process.env.GEMINI_API_KEY) committee.push('gemini');

    if (committee.length === 0) {
        const failOpen = String(process.env.VERIFIER_FAIL_OPEN || 'false').toLowerCase() === 'true';
        return failOpen
            ? { verdict: 'approve', confidence: 0.5, rationale: 'No Keys (fail-open)' }
            : { verdict: 'reject', confidence: 0.0, rationale: 'No verifier provider keys configured' };
    }

    // --- CHECK 1: STRUCTURAL EVIDENCE ---
    if (sources.length > 0) {
        // Simple Regex: [1], [2] OR (Source 1) OR Source: ...
        const hasStructure = /\[\d+\]/.test(answer) || /Source \d+/.test(answer) || /\(Source/.test(answer);
        
        if (!hasStructure) {
             return { 
                 verdict: 'revise', 
                 confidence: 0.3, 
                 rationale: 'EVIDENCE MISSING: Answer uses sources but contains no inline citations (e.g. [1]).',
                 issues: [{ type: 'citation', detail: 'Missing inline citations' }]
             };
        }
    }

    // --- CHECK 2: LLM AUDIT ---
    const prompt = {
        system: `You are a strict AI Auditor.
        INPUT: Answer from a worker.
        EVIDENCE: List of sources.
        
        TASK:
        1. Check if the Answer is supported by Evidence.
        2. Check for hallucinations.
        
        OUTPUT JSON: { "verdict": "approve|revise|reject", "trust_score": 0-100, "issues": [], "repair_instructions": "..." }`,
        user: `ANSWER:\n${answer}\n\nEVIDENCE:\n${JSON.stringify(sources)}`
    };

    const promises = committee.map(p => callOneVerifier(p, prompt));
    const results = await Promise.all(promises);

    const votes = [];
    for(const res of results) {
        if(res?.text) {
            try {
                const json = JSON.parse(res.text.replace(/```json|```/g, '').trim());
                votes.push(json);
            } catch(e) {}
        }
    }

    if(votes.length === 0) return { verdict: 'revise', confidence: 0.0, rationale: 'Verifier Failed' };

    const avgScore = votes.reduce((a,b) => a + (b.trust_score||0), 0) / votes.length;
    const rejects = votes.filter(v => v.verdict === 'reject').length;
    
    const finalVerdict = rejects > 0 ? 'reject' : (avgScore >= TRUST_GATE_PERCENT ? 'approve' : 'revise');

    return {
        ok: true,
        verdict: finalVerdict,
        confidence: avgScore / 100,
        trust_score: Math.round(avgScore),
        issues: votes.flatMap(v => v.issues || []),
        rationale: votes[0]?.repair_instructions || "Audit Complete"
    };
}

module.exports = { verifyAnswer };