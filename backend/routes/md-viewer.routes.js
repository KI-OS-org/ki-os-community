/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
/**
 * KI-OS Markdown Viewer API
 * 
 * API für Markdown-Viewer mit Datei-Explorer und Edit-Funktion.
 * 
 * Endpoints:
 * - GET  /api/md-viewer/tree  — Datei-Baum laden
 * - GET  /api/md-viewer/load   — Markdown-Datei laden
 * - POST /api/md-viewer/save   — Markdown-Datei speichern
 * 
 * @module routes/md-viewer.routes.js
 * @license AGPL-3.0
 */

'use strict';

const express = require('express');
const fs = require('fs').promises;
const path = require('path');

const router = express.Router();

const BASE_PATH = '/Users/is/KI-OS';
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

/**
 * GET /api/md-viewer/tree
 * 
 * Lädt Datei-Baum für Explorer.
 */
router.get('/tree', async (req, res) => {
  try {
    const requestPath = req.query.path || BASE_PATH;
    
    // Security: Nur Zugriff auf /Users/is/KI-OS erlauben
    const safePath = await sanitizePath(requestPath);
    if (!safePath) {
      return res.status(403).json({ error: 'Zugriff verweigert' });
    }

    const tree = await buildFileTree(safePath, 2); // Max 2 levels deep
    
    res.json(tree);
  } catch (error) {
    console.error('[MD-Viewer] Tree error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/md-viewer/load
 * 
 * Lädt Markdown-Datei.
 */
router.get('/load', async (req, res) => {
  try {
    const requestPath = req.query.path || '';
    
    // Security: Nur .md Dateien in /Users/is/KI-OS
    const safePath = await sanitizePath(requestPath);
    if (!safePath) {
      return res.status(403).json({ error: 'Zugriff verweigert' });
    }

    // Check file extension
    if (!safePath.endsWith('.md')) {
      return res.status(400).json({ error: 'Nur .md Dateien erlaubt' });
    }

    // Check file size
    const stats = await fs.stat(safePath);
    if (stats.size > MAX_FILE_SIZE) {
      return res.status(400).json({ error: 'Datei zu groß (max 5MB)' });
    }

    const content = await fs.readFile(safePath, 'utf-8');
    
    res.json({
      success: true,
      content,
      path: safePath,
      size: stats.size,
    });
  } catch (error) {
    console.error('[MD-Viewer] Load error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/md-viewer/save
 * 
 * Speichert Markdown-Datei.
 */
router.post('/save', async (req, res) => {
  try {
    const { path: requestPath, content } = req.body;
    
    if (!requestPath || !content) {
      return res.status(400).json({ error: 'path und content erforderlich' });
    }

    // Security: Nur .md Dateien in /Users/is/KI-OS
    const safePath = await sanitizePath(requestPath);
    if (!safePath) {
      return res.status(403).json({ error: 'Zugriff verweigert' });
    }

    if (!safePath.endsWith('.md')) {
      return res.status(400).json({ error: 'Nur .md Dateien erlaubt' });
    }

    await fs.writeFile(safePath, content, 'utf-8');
    
    res.json({
      success: true,
      path: safePath,
    });
  } catch (error) {
    console.error('[MD-Viewer] Save error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ─── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Pfad validieren und säubern (Security).
 */
async function sanitizePath(requestPath) {
  // Resolve to absolute path
  const resolved = path.resolve(requestPath);
  
  // Must be within BASE_PATH
  if (!resolved.startsWith(BASE_PATH)) {
    return null;
  }
  
  // No path traversal
  if (resolved.includes('..')) {
    return null;
  }
  
  // Check if exists
  try {
    await fs.access(resolved);
    return resolved;
  } catch {
    return null;
  }
}

/**
 * Datei-Baum rekursiv aufbauen.
 */
async function buildFileTree(dirPath, maxDepth = 2, currentDepth = 0) {
  if (currentDepth > maxDepth) {
    return null;
  }

  try {
    const items = await fs.readdir(dirPath, { withFileTypes: true });
    const tree = [];

    // Sort: folders first, then files
    items.sort((a, b) => {
      if (a.isDirectory() && !b.isDirectory()) return -1;
      if (!a.isDirectory() && b.isDirectory()) return 1;
      return a.name.localeCompare(b.name);
    });

    for (const item of items) {
      // Skip hidden files and node_modules
      if (item.name.startsWith('.') || item.name === 'node_modules') {
        continue;
      }

      const itemPath = path.join(dirPath, item.name);

      if (item.isDirectory()) {
        const children = await buildFileTree(itemPath, maxDepth, currentDepth + 1);
        tree.push({
          name: item.name,
          type: 'folder',
          path: itemPath,
          children: children || [],
        });
      } else if (item.isFile() && item.name.endsWith('.md')) {
        tree.push({
          name: item.name,
          type: 'file',
          path: itemPath,
        });
      }
    }

    return tree;
  } catch (error) {
    console.error('[MD-Viewer] buildFileTree error:', error);
    return [];
  }
}

module.exports = router;
