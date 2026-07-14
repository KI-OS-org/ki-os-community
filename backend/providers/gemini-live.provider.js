/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
// (c) 2026 KI-OS.org by Ingo Schaffer und Kimba · AGPL-3.0-only
'use strict';

const axios = require('axios');

const MODEL = 'gemini-3.1-flash-live-preview';
const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const DEFAULT_VOICE = 'Aoede';
const DEFAULT_LANG = 'de';
const DEFAULT_MOOD = 'neutral';

async function synthesize(text, options = {}) {
    const startTime = Date.now();
    const { voice = DEFAULT_VOICE, lang = DEFAULT_LANG, mood = DEFAULT_MOOD } = options;

    if (!process.env.GEMINI_API_KEY) {
        throw new Error('GEMINI_API_KEY environment variable not set');
    }

    if (!text) {
        throw new Error('Text input is required');
    }

    const url = `${API_BASE}/${MODEL}:generateContent?key=${process.env.GEMINI_API_KEY}`;

    const requestBody = {
        contents: [{
            parts: [{
                text: `Say this naturally in ${lang} with a ${mood} mood: ${text}`
            }]
        }],
        generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: {
                voiceConfig: {
                    prebuiltVoiceConfig: {
                        voiceName: voice
                    }
                }
            }
        }
    };

    try {
        const response = await axios.post(url, requestBody, {
            headers: {
                'Content-Type': 'application/json'
            }
        });

        const elapsed = Date.now() - startTime;

        if (!response.data?.candidates?.[0]?.content?.parts?.[0]?.inlineData) {
            throw new Error('Invalid response format from Gemini API');
        }

        const audioData = response.data.candidates[0].content.parts[0].inlineData;

        return {
            audioBase64: audioData.data,
            mimeType: 'audio/mp3',
            provider: 'gemini-live',
            voice,
            latencyMs: elapsed
        };
    } catch (error) {
        const errorMessage = error.response?.data?.error?.message ||
                           error.message ||
                           'Unknown error occurred during synthesis';
        throw new Error(`Gemini Live synthesis failed: ${errorMessage}`);
    }
}

function isAvailable() {
    return !!process.env.GEMINI_API_KEY;
}

module.exports = {
    synthesize,
    isAvailable
};
