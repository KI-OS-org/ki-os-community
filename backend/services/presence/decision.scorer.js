/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
// (c) 2026 KI-OS.org by Ingo Schaffer und Kimba — AGPL-3.0-only
'use strict';

/**
 * Scores a decision capsule based on risk, cost, and urgency factors.
 * @param {Object} warRoom - The decision capsule data
 * @param {string} warRoom.title - Title of the decision
 * @param {string} warRoom.priority - Priority level (CRITICAL, HIGH, MEDIUM, LOW)
 * @param {Array} warRoom.decisions - List of decisions made
 * @param {Array} warRoom.next_steps - List of next steps
 * @param {string} warRoom.created_at - ISO timestamp when created
 * @param {string} warRoom.context - Contextual information
 * @returns {Object} Scores object with riskScore, costScore, urgencyScore (0-100)
 */
function scoreDecision(warRoom) {
    // Validate input
    if (!warRoom || typeof warRoom !== 'object') {
        throw new Error('Invalid warRoom object');
    }

    // Initialize scores
    let riskScore = 0;
    let costScore = 0;
    let urgencyScore = 0;

    // Helper function for keyword matching (context kann Object oder String sein)
    const containsKeyword = (text, keywords) => {
        if (!text) return false;
        const str = typeof text === 'string' ? text : JSON.stringify(text);
        const lowerText = str.toLowerCase();
        return keywords.some(keyword => lowerText.includes(keyword.toLowerCase()));
    };

    // 1. Calculate riskScore
    // Priority component
    const priorityMap = {
        CRITICAL: 80,
        HIGH: 60,
        MEDIUM: 40,
        LOW: 20
    };
    riskScore += priorityMap[warRoom.priority] || 0;

    // Stakeholder mentions
    const stakeholderKeywords = ['Kunde', 'Investor', 'Partner', 'Vorstand', 'CEO', 'CTO'];
    const stakeholderCount = stakeholderKeywords.filter(keyword =>
        containsKeyword(warRoom.context, [keyword])
    ).length;
    riskScore += Math.min(stakeholderCount * 5, 20);

    // High risk keywords
    const highRiskKeywords = ['Compliance', 'Legal', 'Datenschutz', 'Regulierung', 'Haftung'];
    const highRiskCount = highRiskKeywords.filter(keyword =>
        containsKeyword(warRoom.context, [keyword])
    ).length;
    riskScore += highRiskCount * 15;

    // Time pressure keywords
    const timePressureKeywords = ['sofort', 'dringend', 'heute', 'morgen', 'Deadline'];
    if (containsKeyword(warRoom.context, timePressureKeywords)) {
        riskScore += 10;
    }

    // Cap at 100
    riskScore = Math.min(100, riskScore);

    // 2. Calculate costScore
    // Number of decisions
    const decisionCount = warRoom.decisions ? warRoom.decisions.length : 0;
    costScore += Math.min(decisionCount * 5, 50);

    // Number of next steps
    const nextStepsCount = warRoom.next_steps ? warRoom.next_steps.length : 0;
    costScore += Math.min(nextStepsCount * 3, 30);

    // Cost-related keywords
    const costKeywords = ['Budget', 'Kosten', 'Investition', 'kaufen', 'Lizenz'];
    const costKeywordCount = costKeywords.filter(keyword =>
        containsKeyword(warRoom.context, [keyword])
    ).length;
    costScore += Math.min(costKeywordCount * 10, 30);

    // Cap at 100
    costScore = Math.min(100, costScore);

    // 3. Calculate urgencyScore
    // Time since creation
    const createdAt = new Date(warRoom.created_at);
    const now = new Date();
    const hoursSinceCreation = (now - createdAt) / (1000 * 60 * 60);

    if (hoursSinceCreation < 1) {
        urgencyScore += 80;
    } else if (hoursSinceCreation < 6) {
        urgencyScore += 60;
    } else if (hoursSinceCreation < 24) {
        urgencyScore += 40;
    } else {
        urgencyScore += 20;
    }

    // Priority component
    if (warRoom.priority === 'CRITICAL') {
        urgencyScore += 20;
    } else if (warRoom.priority === 'HIGH') {
        urgencyScore += 10;
    }

    // Urgency keywords
    const urgencyKeywords = ['sofort', 'jetzt', 'asap', 'dringend'];
    if (containsKeyword(warRoom.context, urgencyKeywords)) {
        urgencyScore += 15;
    }

    // Cap at 100
    urgencyScore = Math.min(100, urgencyScore);

    return {
        riskScore: Math.round(riskScore),
        costScore: Math.round(costScore),
        urgencyScore: Math.round(urgencyScore)
    };
}

module.exports = { scoreDecision };
