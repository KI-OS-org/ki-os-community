/**
 * (c) 2026 KI-OS.org (v6.0) by Ingo Schaffer und Kimba
 * Datei: media.controller.js
 * Diese Datei enthält JavaScript-Logik für Runtime, Services, Tools oder Tests innerhalb des KI-OS AgentMesh.
 */

'use strict';
const { mediaImageRun, mediaVideoRun, mediaJobStatus } = require('./providers/media.provider');

// Wrapper um die Provider-Funktionen als Controller zu exposen
async function handleMediaImage(body) {
    const provider = body.provider || 'replicate'; // Default
    return await mediaImageRun(provider, body);
}

async function handleMediaVideo(body) {
    const provider = body.provider || 'replicate';
    return await mediaVideoRun(provider, body);
}

async function handleMediaStatus(query) {
    const id = query.id || query.job_id;
    const provider = query.provider || 'replicate';
    if(!id) return { error: 'Missing ID' };
    return await mediaJobStatus(provider, id);
}

module.exports = { handleMediaImage, handleMediaVideo, handleMediaStatus };