/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
/**
 * (c) 2026 KI-OS.org by Ingo Schaffer und Kimba
 * Datei: crm.service.js
 * CRM-Service fuer Ambient Sales Intelligence mit SQLite.
 * @license AGPL-3.0-only
 */
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const DB_PATH = process.env.SALES_DB_PATH || path.join(process.cwd(), 'data', 'sales.db');
const VALID_CONTACT_STATUSES = new Set(['open', 'offered', 'negotiating', 'won', 'lost']);
const VALID_OFFER_STATUSES = new Set(['draft', 'sent', 'accepted', 'rejected']);

class CrmService {
  constructor() {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    this.db = new Database(DB_PATH);
    this._createTables();
  }

  _createTables() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS contacts(
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        company TEXT,
        email TEXT,
        phone TEXT,
        status TEXT DEFAULT 'open',
        lastContact TEXT,
        notes TEXT,
        createdAt TEXT
      );

      CREATE TABLE IF NOT EXISTS offers(
        id TEXT PRIMARY KEY,
        contactId TEXT NOT NULL,
        title TEXT,
        priceCents INTEGER DEFAULT 0,
        status TEXT DEFAULT 'draft',
        createdAt TEXT
      );

      CREATE TABLE IF NOT EXISTS followups(
        id TEXT PRIMARY KEY,
        contactId TEXT NOT NULL,
        dueDate TEXT,
        message TEXT,
        sent INTEGER DEFAULT 0
      );
    `);
  }

  _getContactById(id) {
    return this.db.prepare(`
      SELECT id, name, company, email, phone, status, lastContact, notes, createdAt
      FROM contacts
      WHERE id = ?
    `).get(id) || null;
  }

  _assertContactStatus(status) {
    if (!VALID_CONTACT_STATUSES.has(status)) {
      throw new Error(`Invalid contact status: ${status}`);
    }
  }

  _assertOfferStatus(status) {
    if (!VALID_OFFER_STATUSES.has(status)) {
      throw new Error(`Invalid offer status: ${status}`);
    }
  }

  addContact(data = {}) {
    if (!data.name) throw new Error('name is required');
    const contact = {
      id: crypto.randomUUID(),
      name: data.name,
      company: data.company || null,
      email: data.email || null,
      phone: data.phone || null,
      status: data.status || 'open',
      lastContact: data.lastContact || null,
      notes: data.notes || null,
      createdAt: new Date().toISOString()
    };
    this._assertContactStatus(contact.status);
    this.db.prepare(`
      INSERT INTO contacts (id, name, company, email, phone, status, lastContact, notes, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      contact.id,
      contact.name,
      contact.company,
      contact.email,
      contact.phone,
      contact.status,
      contact.lastContact,
      contact.notes,
      contact.createdAt
    );
    return contact;
  }

  updateContactStatus(id, status) {
    this._assertContactStatus(status);
    const result = this.db.prepare(`
      UPDATE contacts
      SET status = ?
      WHERE id = ?
    `).run(status, id);
    if (result.changes === 0) return null;
    return this._getContactById(id);
  }

  getOverdueContacts(days = 14) {
    const safeDays = Number.isFinite(Number(days)) ? Math.max(0, Number(days)) : 14;
    const threshold = new Date(Date.now() - safeDays * 24 * 60 * 60 * 1000).toISOString();
    return this.db.prepare(`
      SELECT id, name, company, email, phone, status, lastContact, notes, createdAt
      FROM contacts
      WHERE lastContact IS NULL OR lastContact = '' OR lastContact < ?
      ORDER BY COALESCE(lastContact, '') ASC, createdAt DESC
    `).all(threshold);
  }

  createOffer(contactId, title, priceCents) {
    const contact = this._getContactById(contactId);
    if (!contact) throw new Error(`contact not found: ${contactId}`);
    const offer = {
      id: crypto.randomUUID(),
      contactId,
      title: title || null,
      priceCents: Number.isFinite(Number(priceCents)) ? Number(priceCents) : 0,
      status: 'draft',
      createdAt: new Date().toISOString()
    };
    this._assertOfferStatus(offer.status);
    this.db.prepare(`
      INSERT INTO offers (id, contactId, title, priceCents, status, createdAt)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      offer.id,
      offer.contactId,
      offer.title,
      offer.priceCents,
      offer.status,
      offer.createdAt
    );
    return offer;
  }

  getPipelineStats() {
    const stats = { open: 0, offered: 0, negotiating: 0, won: 0, lost: 0 };
    const rows = this.db.prepare(`
      SELECT status, COUNT(*) AS count
      FROM contacts
      GROUP BY status
    `).all();
    for (const row of rows) {
      if (Object.prototype.hasOwnProperty.call(stats, row.status)) {
        stats[row.status] = row.count;
      }
    }
    return stats;
  }

  getContacts(status) {
    if (status) {
      this._assertContactStatus(status);
      return this.db.prepare(`
        SELECT id, name, company, email, phone, status, lastContact, notes, createdAt
        FROM contacts
        WHERE status = ?
        ORDER BY createdAt DESC
      `).all(status);
    }
    return this.db.prepare(`
      SELECT id, name, company, email, phone, status, lastContact, notes, createdAt
      FROM contacts
      ORDER BY createdAt DESC
    `).all();
  }
}

module.exports = new CrmService();
