/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
// (c) 2026 KI-OS.org by Ingo Schaffer und Kimba — AGPL-3.0-only
'use strict';

let SILENCE_THRESHOLD_MS = 1500;
const MAX_SPEAKERS = 3;
const SPEAKER_LABELS = ['A', 'B', 'C'];

// Module-global state
let currentSpeakerIndex = 0;
let lastSegmentEndTs = 0;
let sessionStartTs = 0;
let segmentCount = 0;
const speakerCounts = { A: 0, B: 0, C: 0 };

/**
 * Diarizes segments by assigning speaker labels based on silence gaps
 * @param {Array} segments - Input segments from transcriber
 * @returns {Array} Segments enriched with speaker information
 */
function diarize(segments) {
    if (!Array.isArray(segments) || segments.length === 0) {
        return [];
    }

    const diarizedSegments = [];
    
    // Initialize session time if first call
    if (sessionStartTs === 0) {
        sessionStartTs = segments[0].ts;
    }

    for (let i = 0; i < segments.length; i++) {
        const currentSegment = segments[i];
        segmentCount++;

        // Check for speaker change conditions
        if (i > 0) {
            const gap = currentSegment.ts - (segments[i-1].ts + segments[i-1].duration);
            let threshold = SILENCE_THRESHOLD_MS;

            // Apply heuristics to adjust threshold
            const prevText = segments[i-1].text.trim();
            const currentText = currentSegment.text.trim();
            
            // Question/exclamation mark heuristic
            if ((prevText.endsWith('?') || prevText.endsWith('!')) && 
                currentText.length > 0 && prevText[prevText.length-1] !== currentText[0]) {
                threshold += 200;
            }
            
            // Short segment heuristic (interjection)
            const isShortSegment = currentText.split(/\s+/).length < 2;
            
            if (gap > threshold && !isShortSegment) {
                currentSpeakerIndex = (currentSpeakerIndex + 1) % MAX_SPEAKERS;
            }
        }

        const speakerLabel = SPEAKER_LABELS[currentSpeakerIndex];
        speakerCounts[speakerLabel]++;

        diarizedSegments.push({
            ...currentSegment,
            speaker: speakerLabel,
            speakerLabel: `Sprecher ${speakerLabel}`,
            speakerIndex: currentSpeakerIndex
        });

        lastSegmentEndTs = currentSegment.ts + currentSegment.duration;
    }

    return diarizedSegments;
}

/**
 * Resets the diarization session
 */
function resetSession() {
    currentSpeakerIndex = 0;
    lastSegmentEndTs = 0;
    sessionStartTs = 0;
    segmentCount = 0;
    SPEAKER_LABELS.forEach(label => speakerCounts[label] = 0);
}

/**
 * Gets session statistics
 * @returns {Object} Session statistics
 */
function getSessionStats() {
    return {
        totalSegments: segmentCount,
        speakerBreakdown: { ...speakerCounts },
        sessionDurationMs: lastSegmentEndTs - sessionStartTs
    };
}

/**
 * Sets the silence threshold for speaker change detection
 * @param {number} ms - Threshold in milliseconds
 */
function setSilenceThreshold(ms) {
    if (typeof ms === 'number' && ms > 0) {
        SILENCE_THRESHOLD_MS = ms;
    }
}

module.exports = {
    diarize,
    resetSession,
    getSessionStats,
    setSilenceThreshold
};
