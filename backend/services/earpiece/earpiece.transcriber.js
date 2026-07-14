/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
// (c) 2026 KI-OS.org by Ingo Schaffer und Kimba — AGPL-3.0-only
'use strict';

const axios = require('axios');
const FormData = require('form-data');
const { Readable } = require('stream');

const EARPIECE_STT_PROVIDER = process.env.EARPIECE_STT_PROVIDER || 'openai';
const EARPIECE_BUFFER_SECS = parseInt(process.env.EARPIECE_BUFFER_SECS) || 90;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_API_URL = 'https://api.openai.com/v1/audio/transcriptions';

const buffer = [];
let totalDuration = 0;

async function transcribeChunk(audioBuffer, mimeType) {
    if (EARPIECE_STT_PROVIDER === 'local') {
        return {
            text: '[MOCK TRANSKRIPT: Meeting läuft...]',
            confidence: 0.9,
            language: 'de'
        };
    }

    if (!OPENAI_API_KEY) {
        throw new Error('OPENAI_API_KEY is not set');
    }

    const form = new FormData();
    const audioStream = new Readable();
    audioStream.push(audioBuffer);
    audioStream.push(null);

    form.append('file', audioStream, {
        filename: 'audio_chunk',
        contentType: mimeType
    });
    form.append('model', 'whisper-1');
    form.append('response_format', 'json');

    try {
        const response = await axios.post(OPENAI_API_URL, form, {
            headers: {
                ...form.getHeaders(),
                'Authorization': `Bearer ${OPENAI_API_KEY}`
            }
        });

        return {
            text: response.data.text,
            confidence: response.data.confidence || 0.8, // Default confidence if not provided
            language: response.data.language || 'de' // Default language if not provided
        };
    } catch (error) {
        console.error('Transcription error:', error.message);
        throw new Error('Transcription failed');
    }
}

function addToBuffer(segment) {
    if (!segment || !segment.text || !segment.ts) {
        throw new Error('Invalid segment format');
    }

    buffer.push(segment);
    totalDuration += segment.duration || 1; // Default to 1 second if duration not provided

    // Remove oldest segments if buffer exceeds max duration
    while (totalDuration > EARPIECE_BUFFER_SECS) {
        const oldestSegment = buffer.shift();
        totalDuration -= oldestSegment.duration || 1;
    }
}

function getBuffer(windowSecs = EARPIECE_BUFFER_SECS) {
    if (windowSecs <= 0) {
        return [];
    }

    if (windowSecs >= EARPIECE_BUFFER_SECS) {
        return [...buffer];
    }

    const now = Date.now();
    return buffer.filter(segment => {
        const segmentAge = (now - segment.ts) / 1000;
        return segmentAge <= windowSecs;
    });
}

function getLastText(n = 1) {
    if (n <= 0 || buffer.length === 0) {
        return '';
    }

    const segmentsToJoin = buffer.slice(-n);
    return segmentsToJoin.map(s => s.text).join(' ');
}

function clearBuffer() {
    buffer.length = 0;
    totalDuration = 0;
}

function getBufferStats() {
    const languages = [...new Set(buffer.map(s => s.language || 'unknown'))];

    return {
        segmentCount: buffer.length,
        totalSecs: totalDuration,
        languages: languages
    };
}

module.exports = {
    transcribeChunk,
    addToBuffer,
    getBuffer,
    getLastText,
    clearBuffer,
    getBufferStats
};
