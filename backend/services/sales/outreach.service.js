/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
// (c) 2026 KI-OS.org by Ingo Schaffer und Kimba · AGPL-3.0-only

const { KimbaDnaService } = require('./kimba-dna.service');
const Database = require('better-sqlite3');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const DB_PATH = process.env.SALES_DB_PATH || path.join(process.cwd(), 'data', 'sales.db');

class OutreachService {
  constructor() {
    this.db = new Database(DB_PATH);
    this._initDb();
  }

  _initDb() {
    this.db.prepare(`
      CREATE TABLE IF NOT EXISTS outreach_drafts (
        id TEXT PRIMARY KEY,
        contactId TEXT NOT NULL,
        channel TEXT NOT NULL,
        subject TEXT,
        body TEXT NOT NULL,
        status TEXT DEFAULT 'draft',
        createdAt TEXT NOT NULL
      )
    `).run();
  }

  draftOutreach(contact, channel = 'email') {
    const dna = new KimbaDnaService();
    const profile = dna.getProfile();
    const now = new Date().toISOString();
    const id = crypto.randomUUID();

    let subject = null;
    let body = '';

    if (profile) {
      // Personalisierter Text mit DNA-Profil
      const expertise = profile.expertise?.[0] || 'Ihre Branche';
      body += `Ich bin ${profile.name} und spezialisiert auf ${expertise}. `;
    } else {
      // Generisches Template ohne DNA-Profil
      body += 'Ich möchte Sie gerne kennenlernen. ';
    }

    // Kontakt-spezifischer Teil
    if (contact.notes) {
      body += `Ich habe gesehen, dass ${contact.notes}. `;
    } else {
      body += `Ihre Arbeit bei ${contact.company} finde ich sehr spannend. `;
    }

    // Channel-spezifische Anpassungen
    switch (channel) {
      case 'email':
        subject = `Kurze Anfrage — ${contact.company}`;
        body += 'Haben Sie 15 Minuten für ein kurzes Gespräch?';
        break;
      case 'linkedin':
        body = body.split('.').slice(0, 3).join('.') + '.';
        break;
      case 'whatsapp':
        body = body.split('.').slice(0, 2).join('.') + '.';
        body = body.replace('Ich bin', 'Hi, ich bin').replace('Haben Sie', 'Hast du');
        break;
    }

    const stmt = this.db.prepare(`
      INSERT INTO outreach_drafts (id, contactId, channel, subject, body, status, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(id, contact.id, channel, subject, body, 'draft', now);

    return {
      id,
      contactId: contact.id,
      channel,
      subject,
      body,
      status: 'draft',
      createdAt: now
    };
  }

  getDrafts(contactId) {
    return this.db.prepare(`
      SELECT * FROM outreach_drafts 
      WHERE contactId = ?
      ORDER BY createdAt DESC
    `).all(contactId);
  }

  updateStatus(draftId, status) {
    const validStatuses = ['draft', 'sent', 'approved', 'rejected'];
    if (!validStatuses.includes(status)) {
      throw new Error(`Invalid status: ${status}`);
    }

    const stmt = this.db.prepare(`
      UPDATE outreach_drafts 
      SET status = ? 
      WHERE id = ?
      RETURNING *
    `);
    return stmt.get(status, draftId);
  }

  getScheduledFollowups(daysDue = 7) {
    return this.db.prepare(`
      SELECT id, name, company, lastContact, 
             julianday('now') - julianday(lastContact) as daysSince
      FROM contacts
      WHERE julianday('now') - julianday(lastContact) >= ?
      ORDER BY daysSince DESC
    `).all(daysDue);
  }
}

module.exports = { OutreachService };
