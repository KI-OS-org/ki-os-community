/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
// (c) 2026 KI-OS.org by Ingo Schaffer und Kimba — AGPL-3.0-only
'use strict';

const fs = require('fs');
const path = require('path');
const { transcribeChunk, getBuffer, getBufferStats } = require('./earpiece.transcriber');
const { detectMissionSeed } = require('../presence/mission.seed-detector');
const { confirmSeed } = require('../presence/mission.inbox');
const axios = require('axios');

// Constants
const DATA_DIR = path.join(process.cwd(), 'data');
const MEETINGS_DIR = path.join(DATA_DIR, 'meetings');
const SUMMARIES_DIR = path.join(DATA_DIR, 'earpiece', 'summaries');
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const POSTMEETING_LLM_MODEL = process.env.POSTMEETING_LLM_MODEL || 'mistralai/codestral-2508';
const EARPIECE_DRY_RUN = process.env.EARPIECE_DRY_RUN === 'true';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_TTS_MODEL = 'tts-1';
const OPENAI_TTS_VOICE = 'nova';

// Ensure directories exist
fs.mkdirSync(MEETINGS_DIR, { recursive: true });
fs.mkdirSync(SUMMARIES_DIR, { recursive: true });

/**
 * Process meeting end and generate post-meeting report
 * @param {Object} meetingContext - Meeting context
 * @param {string} meetingContext.title - Meeting title
 * @param {Date} meetingContext.startedAt - Meeting start time
 * @param {Date} meetingContext.endedAt - Meeting end time
 * @param {string[]} meetingContext.participants - List of participants
 * @returns {Promise<PostMeetingReport>} Post-meeting report
 */
async function processMeetingEnd(meetingContext) {
    try {
        // Get transcript from buffer
        const bufferStats = getBufferStats();
        const transcriptSegments = getBuffer(bufferStats.totalSecs);
        const transcript = transcriptSegments.map(s => s.text).join(' ');

        // Generate summary
        const summary = await generateSummary(transcript, meetingContext);

        // Save transcript
        const transcriptPath = saveTranscript(transcript, meetingContext);

        // Extract mission seeds
        const missionSeeds = extractMissionSeeds(transcript, summary);

        // Generate audio summary
        const audioSummaryPath = await generateAudioSummary(summary);

        return {
            transcriptPath,
            summary,
            missionSeeds,
            audioSummaryPath
        };
    } catch (error) {
        console.error('Error processing meeting end:', error);
        throw error;
    }
}

/**
 * Generate executive summary from transcript
 * @param {string} transcript - Meeting transcript
 * @param {Object} meetingContext - Meeting context
 * @returns {Promise<Object>} Summary object
 */
async function generateSummary(transcript, meetingContext) {
    if (EARPIECE_DRY_RUN) {
        return {
            decisions: ['Test-Entscheidung A', 'Test-Entscheidung B'],
            openPoints: ['Offener Punkt 1'],
            nextSteps: ['Schritt 1', 'Schritt 2'],
            keyLearning: '[MOCK] Dry-Run Zusammenfassung'
        };
    }

    if (!OPENROUTER_API_KEY) {
        throw new Error('OPENROUTER_API_KEY is not set');
    }

    const prompt = `Extrahiere aus diesem Transkript die folgenden Informationen:
1. Entscheidungen: Liste konkreter Entscheidungen, die im Meeting getroffen wurden
2. Offene Punkte: Liste offener Fragen oder Themen, die noch nicht geklärt wurden
3. Nächste Schritte: Liste konkreter Aktionen, die als nächstes erledigt werden müssen
4. Key Learning: Kurze Zusammenfassung der wichtigsten Erkenntnisse

Transkript:
${transcript}

Antworte im JSON-Format mit den Feldern decisions, openPoints, nextSteps und keyLearning.`;

    try {
        const response = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
            model: POSTMEETING_LLM_MODEL,
            messages: [
                { role: 'system', content: 'Du bist ein Assistent, der Meeting-Transkripte analysiert und Zusammenfassungen erstellt.' },
                { role: 'user', content: prompt }
            ],
            response_format: { type: 'json_object' }
        }, {
            headers: {
                'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        const content = response.data.choices[0].message.content;
        try {
            return JSON.parse(content);
        } catch (parseError) {
            console.error('Failed to parse LLM response:', parseError);
            return {
                decisions: [],
                openPoints: [],
                nextSteps: [],
                keyLearning: 'Zusammenfassung konnte nicht generiert werden.'
            };
        }
    } catch (error) {
        console.error('Error generating summary:', error);
        throw error;
    }
}

/**
 * Save transcript to local file
 * @param {string} transcript - Meeting transcript
 * @param {Object} meetingContext - Meeting context
 * @returns {string} Path to saved transcript
 */
function saveTranscript(transcript, meetingContext) {
    const dateStr = new Date(meetingContext.endedAt).toISOString().split('T')[0];
    let filename = `${dateStr}_${meetingContext.title}`
        .replace(/[^a-z0-9]/gi, '_')
        .toLowerCase()
        .substring(0, 60);
    filename += '.txt';

    const filePath = path.join(MEETINGS_DIR, filename);

    try {
        fs.writeFileSync(filePath, transcript, 'utf8');
        return filePath;
    } catch (error) {
        console.error('Error saving transcript:', error);
        throw error;
    }
}

/**
 * Extract mission seeds from transcript and summary
 * @param {string} transcript - Meeting transcript
 * @param {Object} summary - Summary object
 * @returns {Array<Object>} Array of mission seeds
 */
function extractMissionSeeds(transcript, summary) {
    const seeds = [];

    // Create synthetic events for decisions
    summary.decisions.forEach(decision => {
        const detected = detectMissionSeed([{
            type: 'decision_pending',
            timestamp: new Date().toISOString(),
            confidence: 0.9,
            payload: { decision, context: transcript }
        }]);
        if (detected && detected.length > 0) {
            seeds.push(...detected);
        }
    });

    // Create synthetic events for open points
    summary.openPoints.forEach(point => {
        const detected = detectMissionSeed([{
            type: 'open_point',
            timestamp: new Date().toISOString(),
            confidence: 0.8,
            payload: { point, context: transcript }
        }]);
        if (detected && detected.length > 0) {
            seeds.push(...detected);
        }
    });

    return seeds;
}

/**
 * Generate audio summary from key learning and next steps
 * @param {Object} summary - Summary object
 * @returns {Promise<string|null>} Path to audio file or null
 */
async function generateAudioSummary(summary) {
    if (EARPIECE_DRY_RUN) {
        return path.join(SUMMARIES_DIR, 'mock_audio_summary.mp3');
    }

    if (!OPENAI_API_KEY) {
        console.warn('OPENAI_API_KEY not set, skipping audio summary');
        return null;
    }

    const text = `Zusammenfassung: ${summary.keyLearning} Nächste Schritte: ${summary.nextSteps.join(', ')}`
        .substring(0, 200); // Limit to 200 characters

    try {
        const response = await axios.post('https://api.openai.com/v1/audio/speech', {
            model: OPENAI_TTS_MODEL,
            input: text,
            voice: OPENAI_TTS_VOICE
        }, {
            headers: {
                'Authorization': `Bearer ${OPENAI_API_KEY}`,
                'Content-Type': 'application/json'
            },
            responseType: 'arraybuffer'
        });

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filePath = path.join(SUMMARIES_DIR, `summary_${timestamp}.mp3`);
        fs.writeFileSync(filePath, response.data);
        return filePath;
    } catch (error) {
        console.error('Error generating audio summary:', error);
        return null;
    }
}

module.exports = {
    processMeetingEnd,
    generateSummary,
    saveTranscript,
    extractMissionSeeds,
    generateAudioSummary
};
