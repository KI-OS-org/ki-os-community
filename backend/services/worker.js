/**
 * (c) 2026 KI-OS.org (v6.0) by Ingo Schaffer und Kimba
 * Datei: worker.js
 * Diese Datei enthält JavaScript-Logik für Runtime, Services, Tools oder Tests innerhalb des KI-OS AgentMesh.
 */

'use strict';
const { getJob, setJobResult } = require('./jobs.controller');
const Kernel = require('../core/kernel'); // SINGLE TRUTH
const Reputation = require('./core/reputation.service');
const logger = require('./core/logger.service');

async function runWorker(payload) {
    const jobId = payload.job_id || payload.id;
    if (!jobId) return { error: 'No Job ID' };

    const startTime = Date.now();

    try {
        const job = await getJob(jobId);
        if (!job) throw new Error('Job not found in DB');

        const body = job.payload || {};
        logger.info('worker.job.processing', { message: `[Worker] Processing Job ${jobId} via OS-Kernel...`, jobId });

        // OS DISCIPLINE: Wir nutzen den Kernel!
        // Der Kernel kümmert sich um Routing, Verification, OneVoice und Memory.
        const kernelResult = await Kernel.executeRequest({
            userId: job.user_id,
            query: body.query || body.message || body.input_text,
            intent: body.intent || 'auto',
            attachments: body.attachments || [],
            tenantId: body.tenantId || 'default'
        });

        const duration = Date.now() - startTime;

        if (!kernelResult.success) {
            throw new Error(kernelResult.error || 'Kernel execution failed');
        }

        // Reputation Tracking (Kernel macht das intern, aber wir loggen Job-Erfolg)
        // (Optional: Hier könnte man spezifische Job-Metriken speichern)

        await setJobResult(jobId, kernelResult, null);
        logger.info('worker.job.completed', { message: `[Worker] Finished ${jobId} in ${duration}ms`, jobId, duration });
        return { success: true };

    } catch (e) {
        const duration = Date.now() - startTime;
        logger.error('worker.job.failed', { error: e?.message || String(e), jobId });
        await setJobResult(jobId, null, e.message);
        return { success: false, error: e.message };
    }
}

module.exports = { runWorker };