/**
 * (c) 2026 KI-OS.org (v6.0) by Ingo Schaffer und Kimba
 * Datei: feedback.controller.js
 * Diese Datei enthält JavaScript-Logik für Runtime, Services, Tools oder Tests innerhalb des KI-OS AgentMesh.
 */

'use strict';
const Reputation = require('./core/reputation.service');
const logger = require('./core/logger.service');
const { PKICore } = require('./pki/pki.core');
const pki = new PKICore();

async function handleFeedback(body) {
    const { jobId, rating, comment, userId, tenantId, model, worker } = body;
    // rating: 1-5
    
    logger.info('feedback.received', { message: `[Learning] Feedback ${rating}/5 for Job ${jobId}`, jobId, rating });

    // 1. Reputation Update (Das "Lernen")
    // Wir belohnen/bestrafen das Modell und den Worker-Typ
    if (model) {
        await Reputation.updateScore(`model:${model}`, true, 0, rating);
    }
    if (worker) {
        await Reputation.updateScore(`worker:${worker}`, true, 0, rating);
    }

    // 2. Memory Korrektur (bei schlechtem Feedback)
    if (rating <= 2 && comment) {
        await pki.arbitrateAndStore(userId, tenantId || 'default', `USER KORREKTUR: ${comment}`, 'correction');
    }

    return { success: true, message: "System adjusted based on feedback." };
}

module.exports = { handleFeedback };