/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
// (c) 2026 KI-OS.org by Ingo Schaffer und Kimba — AGPL-3.0-only
// @desc Mobile Filesystem API — Projektverzeichnis für KI-OS Mobile App
'use strict';

const express = require('express');
const fs = require('fs');
const os = require('os');
const path = require('path');

const router = express.Router();

const MAX_FILE_SIZE = 80 * 1024;
const MAX_TREE_DEPTH = 2;
const MEMORY_BASE = path.join(os.homedir(), '.claude/projects/-Users-is-KI-OS/memory');
const ALLOWED_BASES = {
  docs: path.resolve(process.cwd(), 'docs'),
  memory: path.resolve(MEMORY_BASE),
  'mobile/src': path.resolve(process.cwd(), 'mobile/src'),
};

function hasTraversal(inputPath) {
  return inputPath.split(/[\\/]+/).includes('..');
}

function findAllowedBase(requestPath) {
  if (!requestPath) return null;

  const normalized = requestPath.replace(/\\/g, '/');
  const candidates = Object.keys(ALLOWED_BASES).sort((a, b) => b.length - a.length);

  for (const key of candidates) {
    if (normalized === key || normalized.startsWith(`${key}/`)) {
      return { key, basePath: ALLOWED_BASES[key] };
    }
  }

  return null;
}

function resolveAllowedPath(requestPath) {
  const trimmedPath = String(requestPath || '').trim();
  if (!trimmedPath) {
    return { error: { status: 400, message: 'path required' } };
  }

  if (hasTraversal(trimmedPath)) {
    return { error: { status: 400, message: 'Pfad-Traversal nicht erlaubt' } };
  }

  const allowedBase = findAllowedBase(trimmedPath);
  if (!allowedBase) {
    return { error: { status: 403, message: 'Pfad nicht erlaubt' } };
  }

  const relativeSuffix = trimmedPath === allowedBase.key
    ? ''
    : trimmedPath.slice(allowedBase.key.length + 1);
  const resolvedPath = path.resolve(allowedBase.basePath, relativeSuffix);
  const relativeToBase = path.relative(allowedBase.basePath, resolvedPath);

  if (relativeToBase.startsWith('..') || path.isAbsolute(relativeToBase)) {
    return { error: { status: 403, message: 'Pfad nicht erlaubt' } };
  }

  return {
    requestPath: trimmedPath.replace(/\\/g, '/'),
    resolvedPath,
    baseKey: allowedBase.key,
  };
}

function resolveRoot(rawRoot) {
  if (!rawRoot || typeof rawRoot !== 'string') return null;
  const r = rawRoot.trim();
  if (!r.startsWith('/')) return null;
  if (!fs.existsSync(r)) return null;
  const resolved = path.resolve(r);
  return resolved;
}

function resolveRequestPath(requestPath, rawRoot) {
  const resolvedRoot = resolveRoot(rawRoot);

  if (rawRoot && typeof rawRoot === 'string' && rawRoot.trim() && !resolvedRoot) {
    const trimmedRoot = rawRoot.trim();
    if (!trimmedRoot.startsWith('/')) {
      return { error: { status: 400, message: 'root muss ein absoluter Pfad sein' } };
    }
    return { error: { status: 404, message: 'root nicht gefunden' } };
  }

  if (!resolvedRoot) {
    return resolveAllowedPath(requestPath);
  }

  const trimmedPath = String(requestPath || '').trim();
  if (!trimmedPath) {
    return { error: { status: 400, message: 'path required' } };
  }

  if (hasTraversal(trimmedPath)) {
    return { error: { status: 400, message: 'Pfad-Traversal nicht erlaubt' } };
  }

  const resolvedPath = path.resolve(resolvedRoot, trimmedPath);
  if (!resolvedPath.startsWith(resolvedRoot)) {
    return { error: { status: 403, message: 'Pfad nicht erlaubt' } };
  }

  return {
    requestPath: trimmedPath.replace(/\\/g, '/'),
    resolvedPath,
    rootPath: resolvedRoot,
  };
}

async function buildEntry(entryPath, relativePath, depth, maxDepth) {
  const stats = await fs.promises.stat(entryPath);
  const isDirectory = stats.isDirectory();
  const entry = {
    name: path.basename(entryPath),
    type: isDirectory ? 'dir' : 'file',
    path: relativePath.replace(/\\/g, '/'),
    modified: stats.mtime.toISOString(),
  };

  if (!isDirectory) {
    entry.size = stats.size;
    return entry;
  }

  if (depth >= maxDepth) {
    return entry;
  }

  const children = await fs.promises.readdir(entryPath, { withFileTypes: true });
  children.sort((a, b) => a.name.localeCompare(b.name));

  entry.children = await Promise.all(children.map((child) => {
    const childPath = path.join(entryPath, child.name);
    const childRelativePath = path.posix.join(relativePath.replace(/\\/g, '/'), child.name);
    return buildEntry(childPath, childRelativePath, depth + 1, maxDepth);
  }));

  return entry;
}

router.get('/tree', async (req, res) => {
  const resolved = resolveRequestPath(req.query.path, req.query.root);
  if (resolved.error) {
    return res.status(resolved.error.status).json({ error: resolved.error.message });
  }

  try {
    const stats = await fs.promises.stat(resolved.resolvedPath);
    if (!stats.isDirectory()) {
      return res.status(400).json({ error: 'Pfad ist kein Verzeichnis' });
    }

    const entries = await fs.promises.readdir(resolved.resolvedPath, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name));

    const payload = await Promise.all(entries.map((entry) => {
      const entryPath = path.join(resolved.resolvedPath, entry.name);
      const entryRelativePath = path.posix.join(resolved.requestPath, entry.name);
      return buildEntry(entryPath, entryRelativePath, 1, MAX_TREE_DEPTH);
    }));

    return res.json({
      path: resolved.requestPath,
      entries: payload,
    });
  } catch (error) {
    if (error.code === 'ENOENT') {
      return res.status(404).json({ error: 'Pfad nicht gefunden' });
    }
    return res.status(500).json({ error: error.message });
  }
});

router.get('/file', async (req, res) => {
  const resolved = resolveRequestPath(req.query.path, req.query.root);
  if (resolved.error) {
    return res.status(resolved.error.status).json({ error: resolved.error.message });
  }

  try {
    const stats = await fs.promises.stat(resolved.resolvedPath);
    if (!stats.isFile()) {
      return res.status(400).json({ error: 'Pfad ist keine Datei' });
    }
    if (stats.size > MAX_FILE_SIZE) {
      return res.status(413).json({ error: 'Datei zu groß' });
    }

    const content = await fs.promises.readFile(resolved.resolvedPath, 'utf8');

    return res.json({
      path: resolved.requestPath,
      content,
      size: stats.size,
      modified: stats.mtime.toISOString(),
    });
  } catch (error) {
    if (error.code === 'ENOENT') {
      return res.status(404).json({ error: 'Pfad nicht gefunden' });
    }
    return res.status(500).json({ error: error.message });
  }
});

router.post('/mkdir', (req, res) => {
  const root = resolveRoot(req.body?.root);
  const rawRoot = typeof req.body?.root === 'string' ? req.body.root.trim() : '';
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';

  if (!rawRoot) {
    return res.status(400).json({ error: 'root required' });
  }
  if (!rawRoot.startsWith('/')) {
    return res.status(400).json({ error: 'root muss ein absoluter Pfad sein' });
  }
  if (!root) {
    return res.status(404).json({ error: 'root nicht gefunden' });
  }
  if (!name) {
    return res.status(400).json({ error: 'name required' });
  }
  if (name.includes('/') || name.includes('\\') || name.includes('..')) {
    return res.status(400).json({ error: 'Ungültiger Ordnername' });
  }

  try {
    const target = path.join(root, name);
    fs.mkdirSync(target, { recursive: true });
    return res.json({ success: true, path: target });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.post('/init', async (req, res) => {
  const root = resolveRoot(req.body?.root);
  const rawRoot = typeof req.body?.root === 'string' ? req.body.root.trim() : '';

  if (!rawRoot) {
    return res.status(400).json({ error: 'root required' });
  }
  if (!rawRoot.startsWith('/')) {
    return res.status(400).json({ error: 'root muss ein absoluter Pfad sein' });
  }
  if (!root) {
    return res.status(404).json({ error: 'root nicht gefunden' });
  }

  try {
    const docsDir = path.join(root, 'docs');
    const memoryDir = path.join(root, 'memory');
    const readmePath = path.join(docsDir, 'README.md');

    fs.mkdirSync(docsDir, { recursive: true });
    fs.mkdirSync(memoryDir, { recursive: true });
    await fs.promises.writeFile(
      readmePath,
      '# Projekt-Dokumentation\n\nAutomatisch erstellt von KI-OS Mobile.\n',
      'utf8'
    );

    return res.json({
      success: true,
      created: ['docs', 'memory', 'docs/README.md'],
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

module.exports = router;
