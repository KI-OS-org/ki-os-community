/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
/**
 * (c) 2026 KI-OS.org by Ingo Schaffer und Kimba
 * Datei: project.db.service.js
 * Singleton-Service fuer die Projekt-DB mit SQLite und optionaler Vektor-Suche (sqlite-vec).
 * @license AGPL-3.0-only
 */
'use strict';

const path = require('path');
const fs = require('fs');
const logger = require('../core/logger.service');

class ProjectDBService {
  constructor() {
    this._db = null;
    this._vectorEnabled = false;
    this._dbPath = process.env.PROJECT_DB_PATH || path.join(process.cwd(), 'data', 'project.db');
    if (process.env.PROJECT_DB_ENABLED !== 'false') {
      this._open();
    }
  }

  _open(dbPath) {
    if (dbPath) this._dbPath = dbPath;
    fs.mkdirSync(path.dirname(this._dbPath), { recursive: true });
    let Database;
    try {
      Database = require('better-sqlite3');
    } catch (e) {
      logger.warn('project.db: better-sqlite3 not available — DB disabled');
      return;
    }
    this._db = new Database(this._dbPath);
    this._createTables();
    this._maybeEnableVectorSearch();
    logger.info(`project.db: opened at ${this._dbPath}`);
  }

  _createTables() {
    this._db.prepare(`
      CREATE TABLE IF NOT EXISTS docs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        filename TEXT NOT NULL UNIQUE,
        title TEXT,
        content TEXT NOT NULL,
        category TEXT DEFAULT 'general',
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      )
    `).run();

    this._db.prepare(`
      CREATE VIRTUAL TABLE IF NOT EXISTS docs_fts USING fts5(
        filename, title, content, content='docs', content_rowid='id'
      )
    `).run();

    this._db.prepare(`
      CREATE TRIGGER IF NOT EXISTS docs_ai AFTER INSERT ON docs BEGIN
        INSERT INTO docs_fts(rowid, filename, title, content) VALUES (new.id, new.filename, new.title, new.content);
      END
    `).run();

    this._db.prepare(`
      CREATE TRIGGER IF NOT EXISTS docs_au AFTER UPDATE ON docs BEGIN
        INSERT INTO docs_fts(docs_fts, rowid, filename, title, content) VALUES ('delete', old.id, old.filename, old.title, old.content);
        INSERT INTO docs_fts(rowid, filename, title, content) VALUES (new.id, new.filename, new.title, new.content);
      END
    `).run();

    this._db.prepare(`
      CREATE TRIGGER IF NOT EXISTS docs_ad AFTER DELETE ON docs BEGIN
        INSERT INTO docs_fts(docs_fts, rowid, filename, title, content) VALUES ('delete', old.id, old.filename, old.title, old.content);
      END
    `).run();
  }

  _maybeEnableVectorSearch() {
    try {
      const sqliteVec = require('sqlite-vec');
      sqliteVec.load(this._db);
      this._vectorEnabled = true;
      try {
        this._db.prepare(`ALTER TABLE docs ADD COLUMN embedding BLOB`).run();
      } catch (_) { /* column already exists */ }
      logger.info('project.db: sqlite-vec enabled');
    } catch (e) {
      logger.debug('project.db: sqlite-vec not available, FTS-only mode');
    }
  }

  open(dbPath) { this._open(dbPath); }

  close() {
    if (this._db) { this._db.close(); this._db = null; }
  }

  upsert(doc) {
    if (!this._db) return { id: null };
    const { filename, title, content, category = 'general' } = doc;
    const result = this._db.prepare(`
      INSERT INTO docs (filename, title, content, category, updated_at)
      VALUES (?, ?, ?, ?, datetime('now'))
      ON CONFLICT(filename) DO UPDATE SET
        title = excluded.title,
        content = excluded.content,
        category = excluded.category,
        updated_at = excluded.updated_at
    `).run(filename, title || filename, content, category);
    return { id: result.lastInsertRowid };
  }

  search(query, limit = 10) {
    if (!this._db) return [];
    return this._db.prepare(`
      SELECT d.id, d.filename, d.title, d.category,
             snippet(docs_fts, 2, '**', '**', '...', 20) AS snippet
      FROM docs_fts
      JOIN docs d ON d.id = docs_fts.rowid
      WHERE docs_fts MATCH ?
      ORDER BY rank
      LIMIT ?
    `).all(query, limit);
  }

  get(filename) {
    if (!this._db) return null;
    return this._db.prepare(`
      SELECT id, filename, title, content, category, updated_at FROM docs WHERE filename = ?
    `).get(filename);
  }

  list(category, limit = 50, offset = 0) {
    if (!this._db) return [];
    if (category) {
      return this._db.prepare(`
        SELECT id, filename, title, category, updated_at FROM docs WHERE category = ? LIMIT ? OFFSET ?
      `).all(category, limit, offset);
    }
    return this._db.prepare(`
      SELECT id, filename, title, category, updated_at FROM docs LIMIT ? OFFSET ?
    `).all(limit, offset);
  }

  remove(filename) {
    if (!this._db) return;
    this._db.prepare(`DELETE FROM docs WHERE filename = ?`).run(filename);
  }

  getStats() {
    if (!this._db) return { total: 0, categories: {}, dbPath: this._dbPath, vectorEnabled: false };
    const total = this._db.prepare(`SELECT COUNT(*) AS c FROM docs`).get().c;
    const cats = this._db.prepare(`SELECT category, COUNT(*) AS c FROM docs GROUP BY category`).all();
    return {
      total,
      categories: cats.reduce((a, r) => { a[r.category] = r.c; return a; }, {}),
      dbPath: this._dbPath,
      vectorEnabled: this._vectorEnabled
    };
  }
}

module.exports = new ProjectDBService();
