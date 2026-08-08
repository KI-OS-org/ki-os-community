/**
 * KI-OS Community Edition — Core Infrastructure
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: Apache License 2.0
 * SPDX-License-Identifier: Apache-2.0
 */
// (c) 2026 KI-OS.org by Ingo Schaffer und Kimba — AGPL-3.0-only
const { getEmbedding, findSimilarDecisions } = require('./decision.history');
const axios = require('axios');

const daysSince = (isoDate) => {
  const now = new Date();
  const then = new Date(isoDate);
  const diffTime = Math.abs(now - then);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return isNaN(diffDays) ? 0 : diffDays;
};

const detectContradiction = async (userId, newStatement) => {
  try {
    const queryEmbedding = await getEmbedding(newStatement);
    const matches = findSimilarDecisions(userId, queryEmbedding, 0.70);
    
    if (!matches || matches.length === 0) return { detected: false };

    const match = matches[0];
    const oldContent = match.content.substring(0, 500).replace(/'/g, "\\'");
    const newContent = newStatement.substring(0, 500).replace(/'/g, "\\'");

    const prompt = `
      Vergleiche zwei Aussagen.
      A (alt): '${oldContent}'
      B (neu): '${newContent}'
      Gibt es einen logischen Widerspruch? Antworte nur JSON.
      { "contradiction": boolean, "reason": string }
    `;

    const response = await axios.post(
      process.env.OPENAI_API_BASE + '/chat/completions',
      {
        model: process.env.CONTRADICTION_MODEL || 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' }
      },
      { headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` } }
    );

    const parsed = JSON.parse(response.data.choices[0].message.content);
    
    if (parsed.contradiction) {
      return {
        detected: true,
        oldContent: match.content,
        oldDate: match.createdAt,
        reason: parsed.reason,
        similarity: match.similarity
      };
    }
  } catch (e) {
    console.error('Contradiction Error:', e.message);
  }
  return { detected: false };
};

module.exports = { detectContradiction, daysSince };