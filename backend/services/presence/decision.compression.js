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
const Database = require('better-sqlite3');
const { scoreDecision } = require('./decision.scorer');
const { getSystemPrompt, getUserPrompt, classifyDecision } = require('./decision.templates');
const { callDecisionLLM, getModel } = require('./decision.model-router');
const { getById } = require('../presence/mission.war-room');

const dbPath = process.env.PRESENCE_DB_PATH || path.join(process.cwd(), 'data', 'presence.db');
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const createTable = () => {
  db.prepare(`
    CREATE TABLE IF NOT EXISTS decision_capsules (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      war_room_id    INTEGER NOT NULL,
      question       TEXT,
      recommendation TEXT,
      why            TEXT,
      risk           TEXT,
      alternatives   TEXT,  -- JSON Array
      next_step      TEXT,
      risk_score     INTEGER,
      cost_score     INTEGER,
      urgency_score  INTEGER,
      generated_by   TEXT,
      model          TEXT,
      decision_class TEXT,
      created_at     TEXT NOT NULL
    )
  `).run();
};

createTable();

/**
 * Compresses a War Room into a Decision Capsule using LLM processing
 * @param {number} warRoomId - ID of the War Room to compress
 * @returns {Promise<Object>} Decision Capsule object
 */
async function compress(warRoomId) {
  // 1. Load War Room
  const warRoom = getById(warRoomId);
  if (!warRoom) {
    throw new Error(`War Room with ID ${warRoomId} not found`);
  }

  // 2. Classify decision
  const decisionClass = classifyDecision(warRoom);

  // 3. Calculate scores
  const { riskScore, costScore, urgencyScore } = scoreDecision(warRoom);

  // 4. Build prompts
  const systemPrompt = getSystemPrompt(decisionClass);
  const userPrompt = getUserPrompt(warRoom, decisionClass);

  // 5. Call LLM
  const model = getModel(decisionClass);
  let llmResponse;
  try {
    llmResponse = await callDecisionLLM(systemPrompt, userPrompt, decisionClass);
  } catch (error) {
    throw new Error(`Failed to call LLM for decision compression: ${error.message}`);
  }

  // 6. Parse LLM response (Markdown-Fences entfernen falls vorhanden)
  let parsedResponse;
  try {
    const cleaned = llmResponse.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
    parsedResponse = JSON.parse(cleaned);
  } catch (error) {
    // Fallback response if JSON parsing fails
    parsedResponse = {
      question: `Could not parse LLM response for War Room ${warRoomId}`,
      recommendation: `Error: ${error.message}. Raw response: ${llmResponse}`,
      why: "The LLM response could not be parsed as valid JSON.",
      risk: "High risk of incorrect decision due to LLM processing failure.",
      alternatives: ["Manual review required"],
      nextStep: "Investigate LLM response parsing error",
      generatedBy: "KIMBA Error Handler"
    };
  }

  // 7. Create Decision Capsule
  const now = new Date().toISOString();
  const decisionCapsule = {
    warRoomId,
    question: parsedResponse.question,
    recommendation: parsedResponse.recommendation,
    why: parsedResponse.why,
    risk: parsedResponse.risk,
    alternatives: JSON.stringify(parsedResponse.alternatives || []),
    nextStep: parsedResponse.nextStep,
    riskScore,
    costScore,
    urgencyScore,
    generatedBy: parsedResponse.generatedBy || `KIMBA ${decisionClass}`,
    model,
    decisionClass,
    createdAt: now
  };

  // 8. Save to DB
  const stmt = db.prepare(`
    INSERT INTO decision_capsules
    (war_room_id, question, recommendation, why, risk, alternatives, next_step,
     risk_score, cost_score, urgency_score, generated_by, model, decision_class, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const result = stmt.run(
    decisionCapsule.warRoomId,
    decisionCapsule.question,
    decisionCapsule.recommendation,
    decisionCapsule.why,
    decisionCapsule.risk,
    decisionCapsule.alternatives,
    decisionCapsule.nextStep,
    decisionCapsule.riskScore,
    decisionCapsule.costScore,
    decisionCapsule.urgencyScore,
    decisionCapsule.generatedBy,
    decisionCapsule.model,
    decisionCapsule.decisionClass,
    decisionCapsule.createdAt
  );

  decisionCapsule.id = result.lastInsertRowid;
  decisionCapsule.alternatives = parsedResponse.alternatives || [];

  // 9. Return Decision Capsule
  return decisionCapsule;
}

/**
 * Retrieves a Decision Capsule by War Room ID
 * @param {number} warRoomId - ID of the War Room
 * @returns {Object|null} Decision Capsule or null if not found
 */
function getCapsule(warRoomId) {
  if (!warRoomId) {
    throw new Error('warRoomId is required');
  }

  const stmt = db.prepare('SELECT * FROM decision_capsules WHERE war_room_id = ? ORDER BY created_at DESC LIMIT 1');
  const capsule = stmt.get(warRoomId);

  if (!capsule) {
    return null;
  }

  // Parse JSON fields
  try {
    capsule.alternatives = JSON.parse(capsule.alternatives || '[]');
  } catch (error) {
    capsule.alternatives = [];
  }

  return capsule;
}

/**
 * Lists all Decision Capsules
 * @returns {Array<Object>} Array of Decision Capsules
 */
function listCapsules() {
  const stmt = db.prepare('SELECT * FROM decision_capsules ORDER BY created_at DESC');
  const capsules = stmt.all();

  // Parse JSON fields for each capsule
  return capsules.map(capsule => {
    try {
      capsule.alternatives = JSON.parse(capsule.alternatives || '[]');
    } catch (error) {
      capsule.alternatives = [];
    }
    return capsule;
  });
}

module.exports = {
  compress,
  getCapsule,
  listCapsules
};
