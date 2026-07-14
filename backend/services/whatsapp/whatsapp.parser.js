/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
// (c) 2026 KI-OS.org by Ingo Schaffer und Kimba — AGPL-3.0-only
'use strict';

const axios = require('axios');
const fs = require('fs');
const path = require('path');

async function parseInbound({ from, body, mediaUrl, mediaType }) {
    if (!mediaUrl) {
        return { type: 'text', content: body, originalFrom: from };
    }

    const mt = mediaType || '';
    const isAudio = mt.includes('audio') || mt.includes('voice') || mt.includes('ogg');
    const isFile = mt.includes('pdf') || mt.includes('image') || mt.includes('jpeg') || mt.includes('png');

    if (isAudio || isFile) {
        try {
            const response = await axios.get(mediaUrl, { responseType: 'stream' });
            const uploadDir = path.join(process.cwd(), 'uploads', 'whatsapp');
            fs.mkdirSync(uploadDir, { recursive: true });

            let rawName = 'media';
            try { rawName = path.basename(new URL(mediaUrl).pathname); } catch {}
            const safeName = rawName.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80);
            const filePath = path.join(uploadDir, `${Date.now()}_${safeName}`);

            const writer = fs.createWriteStream(filePath);
            response.data.pipe(writer);

            await new Promise((resolve, reject) => {
                writer.on('finish', resolve);
                writer.on('error', reject);
            });

            if (isAudio) {
                return { type: 'voice', filePath, originalFrom: from };
            } else {
                return { type: 'file', filePath, mediaType, originalFrom: from };
            }
        } catch (error) {
            console.error('Download failed:', error);
            return { type: 'text', content: body, originalFrom: from };
        }
    }

    return { type: 'text', content: body, originalFrom: from };
}

module.exports = { parseInbound };
