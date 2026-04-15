/**
 * (c) 2026 KI-OS.org (v6.0) by Ingo Schaffer und Kimba
 * Datei: kernel.js
 * Diese Datei enthält JavaScript-Logik für Runtime, Services, Tools oder Tests innerhalb des KI-OS AgentMesh.
 */

'use strict';
const { v4: uuidv4 } = require('uuid');
const { routeJob } = require('../services/core/kcu.router');
const { executeTask } = require('../services/core/worker.orchestrator');
const { verifyAnswer } = require('../services/verifier.service');
const VoiceService = require('../services/voice.service');
const Reputation = require('../services/core/reputation.service');
const Telemetry = require('../services/core/system-view.service');
const { superviseTaskExecution, evaluateConfidence } = require('../services/supervisor/supervisor.service');
const runtimeStore = require('../services/ui/runtime.store');
const memoryController = require('../services/memory.controller');
const { evaluateToolPolicy } = require('../services/governance/policy.engine');
const { evaluateSecurityInput } = require('../services/security/security.filter');
const { enqueueDeadLetter } = require('../services/resilience/dlq.service');
const economicService = require('../services/economic/economic.service');
const logger = require('../services/core/logger.service');

const OS_VERSION = require('../../package.json').version;

function sanitize(text) {
    return String(text || '').slice(0, 5000).replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
}


function getPkiCore() {
    if (String(process.env.PKI_ENABLED || 'false').toLowerCase() === 'false') return null;
    try {
        const { PKICore } = require('../services/pki/pki.core');
        return new PKICore();
    } catch (e) {
        logger.warn('kernel.pki.unavailable', { message: e.message });
        return null;
    }
}

const CONFIG = {
    VERIFIER_ENFORCED: true,
    ONE_VOICE_COMPILER: true,
    MAX_REPAIR_ATTEMPTS: 2
};


function persistRoutingOutcome(routing = {}, payload = {}) {
    try {
        if (!routing?.routing?.model) return;
        recordRouteOutcome({
            provider: routing.routing.provider || null,
            model: routing.routing.model,
            success: payload.success !== false,
            latencyMs: Number(payload.latencyMs || 0),
            trustScore: Number(payload.trustScore || 0),
            outcomeCoverage: Number(payload.outcomeCoverage || 0),
            runId: payload.runId || null,
            traceId: payload.traceId || null
        });
    } catch {}
}

async function persistSemanticMemory(payload = {}) {
    try {
        return await memoryController.handleMemory('POST', payload, {});
    } catch (e) {
        Telemetry.logEvent('memory_write_failed', { error: e.message, userId: payload.userId || null, tenantId: payload.tenantId || null, runId: payload.runId || null });
        return { success: false, error: e.message };
    }
}

class Kernel {
    async executeRequest(requestPayload, context = {}) {
        const start = Date.now();
        const requestId = uuidv4();
        const userId = context.pki?.userId || requestPayload.userId || 'guest';
        const tenantId = context.pki?.tenantId || requestPayload.tenantId || 'default';
        const residency = context.pki?.residency || requestPayload.residency || process.env.DEFAULT_DATA_RESIDENCY || 'eu';
        const userClearance = context.pki?.role === 'admin' ? 'secret' : 'internal';
        const run = runtimeStore.createRun({
            runId: context.runId || `run-${requestId}`,
            traceId: context.traceId || null,
            userId,
            tenantId,
            type: 'kernel',
            task: requestPayload.input_text || requestPayload.query || requestPayload.message || ''
        });
        const runId = run.runId;
        
        logger.info('kernel.request.boot', { message: `[Kernel ${OS_VERSION}] Booting Request ${requestId} (User: ${userId}, Run: ${runId})` });

        // 1. CONTEXT
        let userProfile = {};
        let contextMemories = [];
        try {
            const pki = getPkiCore();
            if (pki) {
                userProfile = await pki.getUserProfile(userId, tenantId); // Read-Only
                const q = requestPayload.input_text || requestPayload.query || requestPayload.message;
                if (q) {
                    const emb = await pki.generateEmbedding(q);
                    contextMemories = await pki.retrieveRelevantMemories(userId, tenantId, emb, 5, userClearance);
                }
            }
        } catch (e) { logger.warn('kernel.context.warning', { message: e.message }); }

        // 2. ROUTING
        const jobReq = {
            job_id: requestId,
            user_id: userId,
            input_text: requestPayload.query || requestPayload.message || requestPayload.input_text,
            intent: requestPayload.intent || 'auto',
            input_attachments: requestPayload.attachments || [],
            language: userProfile.preferences?.language || 'de',
            outcomeCoverage: Number(runtimeStore.getMetrics().outcomeCoverage || 0),
            runId
        };

        const routing = await routeJob(jobReq);
        if (!routing.success) throw new Error("Routing failed: " + routing.error);
        runtimeStore.transitionRun(runId, 'ROUTED', { stepName: 'route_job', worker: routing.workerTask?.worker_type || 'router', model: routing.routing?.model || null });

        const metrics = runtimeStore.getMetrics();
        const economicDecision = economicService.evaluateEconomicDecision({
            profileId: requestPayload.economicProfileId || 'balanced-default',
            taskClass: routing.routing?.intent || routing.workerTask?.worker_type || 'default',
            provider: routing.routing?.provider || 'openai',
            model: routing.routing?.model || 'gpt-5.4',
            budgetCents: Number(requestPayload.estimatedBudgetCents || 0),
            trustScore: Number(requestPayload.trustScore || metrics.avgTrustScore || 0),
            outcomeCoverage: Number(requestPayload.outcomeCoverage || metrics.outcomeCoverage || 0),
            latencyMs: Number(requestPayload.latencyMs || metrics.averageLatencyMs || 0),
            roiSignal: Number(requestPayload.roiSignal || 0)
        });
        if (economicDecision?.action && economicDecision.action !== 'keep') {
            routing.routing.provider = economicDecision.targetProvider || routing.routing.provider;
            routing.routing.model = economicDecision.targetModel || routing.routing.model;
            if (routing.workerTask) {
                routing.workerTask.provider = routing.routing.provider;
                routing.workerTask.model = routing.routing.model;
            }
            runtimeStore.recordEvent(runId, {
                type: 'economic.decision.applied',
                action: economicDecision.action,
                targetProvider: routing.routing.provider,
                targetModel: routing.routing.model,
                decisionId: economicDecision.decisionId
            });
        }

        runtimeStore.setExpectedOutcome(runId, { key: 'answer.delivered' });
        if (routing.routing?.intent === 'research' || routing.workerTask?.input_attachments?.length) {
            runtimeStore.setExpectedOutcome(runId, { key: 'answer.with_sources' });
        }

        const requestSecurity = evaluateSecurityInput({ text: jobReq.input_text, source: 'kernel.chat_input', runId, traceId: context.traceId || null });
        if (requestSecurity.decision === 'block') {
            runtimeStore.appendError(runId, { message: 'security_filter_blocked', score: requestSecurity.score });
            runtimeStore.transitionRun(runId, 'FAILED', { stepName: 'security_filter_blocked', worker: 'security', model: null });
            enqueueDeadLetter({ runId, category: 'security', reason: 'prompt_injection_blocked', payload: { userId, tenantId, traceId: context.traceId || null } });
            persistRoutingOutcome(routing, { success: false, latencyMs: Date.now() - start, trustScore: 0, outcomeCoverage: Number(runtimeStore.getRun(runId)?.outcome?.coverage || 0), runId, traceId: context.traceId || null });
            return { success: false, error: 'Security Policy Violation', message: 'Blocked by Security Filter.', meta: { gate: 'security_filter', detail: requestSecurity } };
        }

        // 3. EXECUTION LOOP
        let rawResult;
        let verification;
        let attempt = 0;
        let currentTask = routing.workerTask;
        let repairInstruction = null;

        while (attempt <= CONFIG.MAX_REPAIR_ATTEMPTS) {
            attempt++;
            try {
                const supervised = await superviseTaskExecution({
                    task: currentTask,
                    query: jobReq.input_text,
                    intent: currentTask.worker_type || routing.routing.intent || 'default',
                    traceId: context.traceId,
                    runId,
                    maxRecoveryAttempts: Number(process.env.SUPERVISOR_MAX_RECOVERY_ATTEMPTS || 2),
                    execute: async (taskForAttempt) => {
                        const policy = evaluateToolPolicy({
                            tool: 'llm_invoke',
                            action: taskForAttempt.worker_type || 'chat',
                            ctx: context,
                            payload: {
                                provider: String(taskForAttempt.model || '').toLowerCase().includes('claude') ? 'anthropic' : (String(taskForAttempt.model || '').toLowerCase().includes('gemini') ? 'gemini' : (String(taskForAttempt.model || '').toLowerCase().includes('deepseek') ? 'deepseek' : (String(taskForAttempt.model || '').toLowerCase().includes('openrouter/') ? 'openrouter' : 'openai'))),
                                model: taskForAttempt.model,
                                budgetCents: Number(requestPayload.estimatedBudgetCents || 0),
                                residency
                            }
                        });
                        if (policy.decision === 'deny') {
                            const err = new Error(`governance_denied:${policy.reason}`);
                            err.failureClass = 'policy';
                            err.statusCode = 403;
                            throw err;
                        }
                        if (policy.decision === 'escalate') {
                            runtimeStore.transitionRun(runId, 'WAITING_APPROVAL', { stepName: 'governance_waiting_approval', worker: taskForAttempt.worker_type, model: taskForAttempt.model });
                            const err = new Error(`approval_required:${policy.reason}`);
                            err.failureClass = 'policy';
                            err.statusCode = 403;
                            throw err;
                        }
                        return executeTask(taskForAttempt, repairInstruction, { context, runId, traceId: context.traceId || null, budgetCents: Number(requestPayload.estimatedBudgetCents || 0) });
                    }
                });
                runtimeStore.transitionRun(runId, 'EXECUTING', { stepName: `execute_attempt_${attempt}`, worker: currentTask.worker_type, model: currentTask.model });
                rawResult = supervised.result;
                currentTask = supervised.finalTask || currentTask;
                if (supervised.attempts > 1) {
                    attempt = Math.max(attempt, supervised.attempts);
                }
            } catch (e) {
                Telemetry.logEvent('contract_violation', { model: currentTask.model, error: e.message, failureClass: e.failureClass || null });
                if (e.failureClass && attempt <= CONFIG.MAX_REPAIR_ATTEMPTS) {
                    repairInstruction = `RECOVERY PATH USED: ${e.message}. FIX FORMAT.`;
                    continue;
                }
                throw e;
            }

            if (!CONFIG.VERIFIER_ENFORCED || rawResult.output_type === 'file' || rawResult.output_type === 'media') {
                verification = { verdict: 'approve', trust_score: 100, issues: [] };
                break;
            }

            runtimeStore.transitionRun(runId, 'VERIFYING', { stepName: 'verify_answer', worker: 'verifier', model: currentTask.model });
            verification = await verifyAnswer({ 
                answer: rawResult.output_data, 
                sources: rawResult.sources || [], 
                tier: 'KI+' 
            });

            Telemetry.logEvent('verification', { verdict: verification.verdict, score: verification.trust_score });

            if (verification.verdict === 'approve') break;
            if (verification.verdict === 'reject') break; 

            if (verification.verdict === 'revise') {
                if (attempt <= CONFIG.MAX_REPAIR_ATTEMPTS) {
                    repairInstruction = `VERIFICATION FAILED (Score ${verification.trust_score}): ${verification.rationale}. REPAIR CONTENT.`;
                    continue;
                }
            }
        }

        const success = verification.verdict === 'approve';
        Reputation.updateScore(`model:${routing.routing.model}`, success, Date.now() - start);

        // 4. ADAPTIVE TRUST GATE
        const isResearch = routing.routing.intent === 'research' || rawResult.sources?.length > 0;
        const minScore = isResearch ? 70 : 40;

        const confidence = evaluateConfidence({ verification, minScore });
        if (verification.verdict === 'reject' || verification.trust_score < minScore) {
            Telemetry.logEvent('verifier_block', { score: verification.trust_score, required: minScore, uncertain: confidence.uncertain });
            runtimeStore.appendError(runId, { message: `trust_gate_blocked:${verification.trust_score}/${minScore}` });
            runtimeStore.transitionRun(runId, 'FAILED', { stepName: 'trust_gate_blocked', worker: 'verifier', model: routing.routing?.model || null });
            persistRoutingOutcome(routing, { success: false, latencyMs: Date.now() - start, trustScore: Number(verification.trust_score || 0), outcomeCoverage: Number(runtimeStore.getRun(runId)?.outcome?.coverage || 0), runId, traceId: context.traceId || null });
            return {
                success: false,
                error: "Security Policy Violation",
                message: `Blocked by Trust Gate (Score: ${verification.trust_score}/${minScore}).`,
                meta: { gate: "verifier", detail: verification, confidence }
            };
        }

        // 5. COMPILER
        const compiled = await VoiceService.compileResponse({
            draft: rawResult,
            context: { profile: userProfile, memories: contextMemories },
            verification: verification,
            routing: routing.routing,
            sources: rawResult.sources
        });

        // 6. MEMORY & STATS (Separated)
        {
            const pki = getPkiCore();
            if (pki) {
            // Write Chat
            pki.arbitrateAndStore(userId, tenantId, `Q: ${sanitize(jobReq.input_text)} | A: ${sanitize(compiled.content)}`, 'chat_history', 'internal')
               .catch(()=>{});
            
            // Fire & Forget Stats (Cheap)
            pki.updateStats(userId, tenantId).catch(()=>{});
            
            // Fire & Forget Summary (Expensive & Throttled)
            pki.consolidateMemory(userId, tenantId).catch(()=>{});
            }
            persistSemanticMemory({
                userId,
                category: 'chat',
                text: `Q: ${sanitize(jobReq.input_text)} | A: ${sanitize(compiled.content)}` ,
                traceId: context.traceId || null,
                runId,
                metadata: {
                    traceId: context.traceId || null,
                    runId,
                    verified: verification?.verdict === 'approve',
                    trustScore: verification?.trust_score || 0,
                    routingModel: routing.routing?.model || null,
                    expectedOutcomeKey: isResearch ? 'answer.with_sources' : 'answer.delivered',
                    observedOutcomeKey: 'answer.delivered',
                    outcomeConfidence: confidence?.trustScore || 0,
                    signalSource: 'kernel.standard_flow'
                }
            }).catch(() => {});
        }
        runtimeStore.appendObservedOutcome(runId, { key: 'answer.delivered' });
        runtimeStore.appendOutput(runId, { type: 'answer', content: compiled.content });
        runtimeStore.transitionRun(runId, 'COMPLETED', { stepName: 'response_compiled', worker: 'voice', model: routing.routing?.model || null });
        persistRoutingOutcome(routing, { success: true, latencyMs: Date.now() - start, trustScore: Number(verification?.trust_score || 0), outcomeCoverage: Number(runtimeStore.getRun(runId)?.outcome?.coverage || 0), runId, traceId: context.traceId || null });

        return {
            success: true,
            content: compiled.content,
            meta: {
                id: requestId,
                trace: { routing: routing.routing, verification, compiler: compiled.meta, attempts: attempt, research: rawResult?.meta?.research || null },
                sources: rawResult.sources, // Frontend renders this
                latency: Date.now() - start,
                file: rawResult.file_base64 ? { name: rawResult.file_name, mime: rawResult.file_mime, base64: rawResult.file_base64 } : null
            }
        };
    }
}
module.exports = new Kernel();