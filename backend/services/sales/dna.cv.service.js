/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
// (c) 2026 KI-OS.org by Ingo Schaffer und Kimba · AGPL-3.0-only
'use strict';

const { KimbaDnaService } = require('./kimba-dna.service');
const fs = require('fs');

class CvDnaService {
  constructor() {
    this.dna = new KimbaDnaService();
  }

  async importFromText(text) {
    try {
      const prompt = 'Extract CV data as JSON. Return ONLY valid JSON (no markdown). Keys: name(string), roles(array of {title,company,from,to,achievements[string]}), skills(string[]), sectors(string[]). CV:\n\n' + text.slice(0, 3000);

      const response = await fetch('http://localhost:3000/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': 'kimba',
          'x-role': 'admin'
        },
        body: JSON.stringify({ message: prompt })
      });

      const data = await response.json();
      const reply = data.reply;

      const startIndex = reply.indexOf('{');
      const endIndex = reply.lastIndexOf('}') + 1;
      if (startIndex === -1 || endIndex === 0) {
        throw new Error('No valid JSON found in AI response');
      }

      const jsonStr = reply.substring(startIndex, endIndex);
      const parsed = JSON.parse(jsonStr);

      this._saveToDna(parsed);

      return { success: true, extracted: parsed };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  importFromFile(filePath) {
    try {
      const text = fs.readFileSync(filePath, 'utf-8');
      const result = this.importFromText(text);
      return { ...result, filePath };
    } catch (e) {
      return { success: false, error: e.message, filePath };
    }
  }

  _saveToDna(data) {
    this.dna.setProfile({
      name: data.name || '',
      expertise: data.skills || [],
      targetGroups: data.sectors || [],
      style: '',
      minRateEur: 0,
      noGos: []
    });

    for (const role of (data.roles || [])) {
      const title = role.title || '';
      const company = role.company || '';
      const from = role.from || '';
      const to = role.to || '';
      const achievements = Array.isArray(role.achievements) ? role.achievements : [];
      const answerText = `${from} - ${to}: ${achievements.join(', ')}`.trim();

      this.dna.setInterviewAnswer(`Role: ${title} at ${company}`, answerText);
    }
  }
}

module.exports = { CvDnaService };
