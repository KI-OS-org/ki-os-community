/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
// (c) 2026 KI-OS.org by Ingo Schaffer und Kimba · AGPL-3.0-only
'use strict';

const Database = require('better-sqlite3');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const DB_PATH = process.env.SALES_DB_PATH || './data/sales.db';

class KimbaDnaService {
  constructor() {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    this.db = new Database(DB_PATH);
    this._createTables();
  }

  _createTables() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS kimba_dna (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updatedAt INTEGER NOT NULL
      );
    `);
  }

  _upsert(key, value) {
    const now = Date.now();
    this.db.prepare(`
      INSERT INTO kimba_dna (key, value, updatedAt)
      VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET
        value = excluded.value,
        updatedAt = excluded.updatedAt
    `).run(key, typeof value === 'string' ? value : JSON.stringify(value), now);
  }

  _get(key) {
    const row = this.db.prepare(`
      SELECT value FROM kimba_dna WHERE key = ?
    `).get(key);
    return row ? JSON.parse(row.value) : null;
  }

  _getAllByPrefix(prefix) {
    return this.db.prepare(`
      SELECT key, value FROM kimba_dna 
      WHERE key LIKE ? ESCAPE '\\'
      ORDER BY key
    `).all(`${prefix}%`).map(row => ({
      key: row.key,
      value: JSON.parse(row.value)
    }));
  }

  setProfile(data) {
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid profile data');
    }

    const profile = {
      name: data.name || '',
      expertise: data.expertise || [],
      targetGroups: data.targetGroups || [],
      style: data.style || '',
      minRateEur: Number(data.minRateEur) || 0,
      noGos: data.noGos || []
    };

    this._upsert('profile', profile);
    return profile;
  }

  getProfile() {
    return this._get('profile') || {
      name: '',
      expertise: [],
      targetGroups: [],
      style: '',
      minRateEur: 0,
      noGos: []
    };
  }

  setInterviewAnswer(question, answer) {
    if (!question || typeof question !== 'string') {
      throw new Error('Invalid question');
    }
    
    const hash = crypto.createHash('sha256').update(question).digest('hex');
    const key = `interview_${hash}`;
    this._upsert(key, {
      question,
      answer: answer || '',
      updatedAt: Date.now()
    });
  }

  getInterviewAnswers() {
    const records = this._getAllByPrefix('interview_');
    return records.map(record => ({
      question: record.value.question,
      answer: record.value.answer
    }));
  }

  setStyleCalibration(example, correction) {
    if (!example || typeof example !== 'string') {
      throw new Error('Invalid example');
    }

    const hash = crypto.createHash('sha256').update(example).digest('hex');
    const key = `style_${hash}`;
    this._upsert(key, {
      example,
      correction: correction || '',
      updatedAt: Date.now()
    });
  }

  getStyleCalibration() {
    const records = this._getAllByPrefix('style_');
    return records.map(record => ({
      example: record.value.example,
      correction: record.value.correction
    }));
  }
}

module.exports = { KimbaDnaService };
