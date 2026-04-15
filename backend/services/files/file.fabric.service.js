/**
 * KI-OS — (C) 2026 Ingo Schaffer
 * https://ki-os.org
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const Observability = require('../core/observability.service');

const FABRIC_VERSION = 'v1';
const rootDir = () => process.env.FILE_FABRIC_DIR || path.join(process.cwd(), 'runtime', 'file-fabric');
const manifestPath = () => path.join(rootDir(), 'manifest.json');
const objectsDir = () => path.join(rootDir(), 'objects');

function ensureDirs() {
  fs.mkdirSync(objectsDir(), { recursive: true });
}

function loadManifest() {
  ensureDirs();
  try {
    const raw = fs.readFileSync(manifestPath(), 'utf8');
    const payload = JSON.parse(raw);
    return Array.isArray(payload.items) ? payload : { version: FABRIC_VERSION, items: [] };
  } catch {
    return { version: FABRIC_VERSION, items: [] };
  }
}

function saveManifest(payload) {
  ensureDirs();
  fs.writeFileSync(manifestPath(), JSON.stringify(payload, null, 2), 'utf8');
}

function inferMimeType(name = '') {
  const lower = String(name).toLowerCase();
  if (lower.endsWith('.json')) return 'application/json';
  if (lower.endsWith('.txt') || lower.endsWith('.md')) return 'text/plain';
  if (lower.endsWith('.csv')) return 'text/csv';
  if (lower.endsWith('.pdf')) return 'application/pdf';
  return 'application/octet-stream';
}

function buildMeta(item) {
  return {
    id: item.id,
    name: item.name,
    mimeType: item.mimeType,
    size: item.size,
    sha256: item.sha256,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    userId: item.userId,
    metadata: item.metadata || {},
    tags: item.tags || [],
    storage: item.storage
  };
}

function listFiles(filters = {}) {
  const manifest = loadManifest();
  let items = manifest.items.slice();
  if (filters.userId) items = items.filter((item) => item.userId === String(filters.userId));
  if (filters.q) {
    const q = String(filters.q).toLowerCase();
    items = items.filter((item) => [item.name, item.mimeType, JSON.stringify(item.metadata || {}), (item.tags || []).join(' ')].join(' ').toLowerCase().includes(q));
  }
  return {
    success: true,
    version: FABRIC_VERSION,
    total: items.length,
    items: items.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt))).map(buildMeta)
  };
}

function saveFile(input = {}) {
  ensureDirs();
  const name = String(input.name || input.filename || '').trim() || `file-${Date.now()}.bin`;
  const userId = String(input.userId || 'system');
  const content = input.contentBase64
    ? Buffer.from(String(input.contentBase64), 'base64')
    : Buffer.from(String(input.content || ''), 'utf8');
  const now = new Date().toISOString();
  const id = input.id || `file_${crypto.randomUUID()}`;
  const storage = path.join(objectsDir(), id);
  fs.writeFileSync(storage, content);
  const sha256 = crypto.createHash('sha256').update(content).digest('hex');

  const manifest = loadManifest();
  const idx = manifest.items.findIndex((item) => item.id === id);
  const existing = idx >= 0 ? manifest.items[idx] : null;
  const entry = {
    id,
    name,
    mimeType: String(input.mimeType || existing?.mimeType || inferMimeType(name)),
    size: content.length,
    sha256,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    userId,
    metadata: input.metadata && typeof input.metadata === 'object' ? input.metadata : (existing?.metadata || {}),
    tags: Array.isArray(input.tags) ? input.tags.map(String) : (existing?.tags || []),
    storage
  };
  if (idx >= 0) manifest.items[idx] = entry;
  else manifest.items.push(entry);
  saveManifest(manifest);
  Observability.emit('file.saved', { fileId: id, userId, name, mimeType: entry.mimeType, size: entry.size });
  return { success: true, item: buildMeta(entry) };
}

function getFile(fileId) {
  const manifest = loadManifest();
  const item = manifest.items.find((entry) => entry.id === String(fileId));
  if (!item) return null;
  return buildMeta(item);
}

function getFileContent(fileId) {
  const manifest = loadManifest();
  const item = manifest.items.find((entry) => entry.id === String(fileId));
  if (!item) {
    const error = new Error('file_not_found');
    error.statusCode = 404;
    throw error;
  }
  const content = fs.readFileSync(item.storage);
  return {
    success: true,
    item: buildMeta(item),
    contentBase64: content.toString('base64'),
    contentText: /^text\/|application\/json/.test(item.mimeType) ? content.toString('utf8') : undefined
  };
}

function deleteFile(fileId) {
  const manifest = loadManifest();
  const idx = manifest.items.findIndex((entry) => entry.id === String(fileId));
  if (idx < 0) return { success: false, error: 'file_not_found' };
  const [item] = manifest.items.splice(idx, 1);
  try { fs.unlinkSync(item.storage); } catch {}
  saveManifest(manifest);
  Observability.emit('file.deleted', { fileId: item.id, userId: item.userId, name: item.name });
  return { success: true, deleted: buildMeta(item) };
}

function getFabricPayload() {
  const manifest = loadManifest();
  return {
    success: true,
    version: FABRIC_VERSION,
    storage: { rootDir: rootDir(), objectsDir: objectsDir(), manifestPath: manifestPath() },
    summary: {
      total: manifest.items.length,
      bytes: manifest.items.reduce((sum, item) => sum + Number(item.size || 0), 0),
      mimeTypes: manifest.items.reduce((acc, item) => {
        acc[item.mimeType] = (acc[item.mimeType] || 0) + 1;
        return acc;
      }, {})
    },
    items: manifest.items.map(buildMeta)
  };
}

function resetFabric() {
  try { fs.rmSync(rootDir(), { recursive: true, force: true }); } catch {}
}

module.exports = {
  FABRIC_VERSION,
  saveFile,
  listFiles,
  getFile,
  getFileContent,
  deleteFile,
  getFabricPayload,
  resetFabric
};
