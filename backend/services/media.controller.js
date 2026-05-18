/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
/**
 * (c) 2026 KI-OS.org (v1.6.0) by Ingo Schaffer und Kimba
 * Datei: media.controller.js
 * Diese Datei enthält JavaScript-Logik für Runtime, Services, Tools oder Tests innerhalb des KI-OS AgentMesh.
 * @license AGPL-3.0-only
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