/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
// (c) 2026 KI-OS.org by Ingo Schaffer und Kimba · AGPL-3.0-only
'use strict';
const { KimbaDnaService } = require('./kimba-dna.service');
const https = require('https');
const fs = require('fs');

class LinkedInDnaService {
  constructor() {
    this.dna = new KimbaDnaService();
  }

  async importFromUrl(url) {
    if (!url.startsWith('https://www.linkedin.com/in/')) {
      throw new Error('Invalid LinkedIn URL');
    }

    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Accept': 'text/html'
      }
    };

    return new Promise((resolve, reject) => {
      https.get(url, options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          if (res.statusCode === 999 || data.includes('authwall')) {
            return resolve({ success: false, reason: 'profile_private' });
          }

          // Parse HTML with regex
          const nameMatch = data.match(/<meta property="og:title" content="([^"]+)"/) ||
                           data.match(/<h1[^>]*>([^<]+)<\/h1>/);
          const name = nameMatch ? nameMatch[1].trim() : '';

          const headlineMatch = data.match(/<meta property="og:description" content="([^"]+)"/) ||
                               data.match(/<div class="text-body-medium[^>]*>([^<]+)<\/div>/);
          const headline = headlineMatch ? headlineMatch[1].trim() : '';

          const companyMatch = data.match(/<div class="current-company[^>]*>([^<]+)<\/div>/) ||
                              data.match(/<div class="experience-item[^>]*>([^<]+)<\/div>/);
          const company = companyMatch ? companyMatch[1].trim() : '';

          const profileData = { name, headline, company, skills: [], positions: [] };
          this._saveToProfile(profileData);

          resolve({ success: true, imported: profileData });
        });
      }).on('error', (err) => {
        reject(err);
      });
    });
  }

  importFromCsv(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').filter(line => line.trim() !== '');

    if (lines.length < 2) {
      throw new Error('Invalid CSV format: no data rows found');
    }

    const headers = lines[0].split(',').map(h => h.trim());
    const dataRows = lines.slice(1);

    const importedData = dataRows.map(row => {
      const values = row.split(',').map(v => v.trim());
      const data = {};

      headers.forEach((header, index) => {
        switch (header) {
          case 'First Name':
            data.firstName = values[index];
            break;
          case 'Last Name':
            data.lastName = values[index];
            break;
          case 'Headline':
            data.headline = values[index];
            break;
          case 'Summary':
            data.summary = values[index];
            break;
          case 'Industry':
            data.industry = values[index];
            break;
          case 'Current Position':
            data.currentPosition = values[index];
            break;
          case 'Employer':
            data.employer = values[index];
            break;
          case 'School':
            data.school = values[index];
            break;
        }
      });

      const mapped = {
        name: `${data.firstName || ''} ${data.lastName || ''}`.trim(),
        headline: data.headline || '',
        industry: data.industry || '',
        currentRole: data.currentPosition || '',
        company: data.employer || '',
        school: data.school || ''
      };

      this._saveToProfile(mapped);
      return mapped;
    });

    return { success: true, imported: importedData, rows: dataRows.length };
  }

  importFromJson(data) {
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid JSON data');
    }

    const mapped = {
      name: `${data.firstName || ''} ${data.lastName || ''}`.trim(),
      headline: data.headline || '',
      summary: data.summary || '',
      industry: data.industry || '',
      skills: data.skills || [],
      positions: data.positions || []
    };

    // Save positions as interview answers
    if (mapped.positions && mapped.positions.length > 0) {
      mapped.positions.forEach(position => {
        const question = `Role: ${position.title || ''} at ${position.company || ''}`;
        const answer = `${position.startDate || ''} - ${position.endDate || ''}: ${position.description || ''}`;
        this.dna.setInterviewAnswer(question, answer);
      });
    }

    this._saveToProfile(mapped);
    return { success: true, imported: mapped };
  }

  _saveToProfile(data) {
    this.dna.setProfile({
      name: data.name || '',
      expertise: data.skills || [],
      targetGroups: [],
      style: data.headline || '',
      minRateEur: 0,
      noGos: []
    });
  }
}

module.exports = { LinkedInDnaService };
