/**
 * (c) 2026 KI-OS.org by Ingo Schaffer und Kimba
 * Datei: embedding.service.js
 * Text → Vector Embedding via OpenAI text-embedding-3-small.
 * Fallback: deterministischer Hash-Vektor (Dev/Test, kein Production-Qualitätsniveau).
 * @license AGPL-3.0-only
 */

'use strict';

// ─── Cache (LRU, max 500) ─────────────────────────────────────────────────────

const _cache  = new Map();
const MAX_CACHE = 500;

function cacheGet(key) { return _cache.get(key); }
function cacheSet(key, val) {
  if (_cache.size >= MAX_CACHE) _cache.delete(_cache.keys().next().value);
  _cache.set(key, val);
}

// ─── OpenAI Client (lazy) ─────────────────────────────────────────────────────

let _client = null;

function getClient() {
  if (_client) return _client;
  if (!process.env.OPENAI_API_KEY) return null;
  try {
    const { OpenAI } = require('openai');
    _client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    return _client;
  } catch {
    return null;
  }
}

// ─── Mock Vector (deterministisch, Dev-only) ──────────────────────────────────

function mockEmbed(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = (h * 0x01000193) >>> 0;
  }
  const vec = new Float32Array(1536);
  for (let i = 0; i < 1536; i++) {
    h = (h * 1664525 + 1013904223) >>> 0;
    vec[i] = ((h & 0xffff) / 0xffff) * 2 - 1;
  }
  return vec;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Konvertiert Text in einen 1536-dim Float32Array.
 * Nutzt OpenAI text-embedding-3-small wenn OPENAI_API_KEY gesetzt.
 * Fallback: deterministischer Hash-Vektor.
 *
 * @param {string} text
 * @returns {Promise<Float32Array>}
 */
async function embed(text) {
  if (!text) return new Float32Array(1536);

  const cached = cacheGet(text);
  if (cached) return cached;

  const client = getClient();
  let vector;

  if (client) {
    try {
      const res = await client.embeddings.create({
        model: 'text-embedding-3-small',
        input: text,
      });
      vector = new Float32Array(res.data[0].embedding);
    } catch {
      vector = mockEmbed(text);
    }
  } else {
    vector = mockEmbed(text);
  }

  cacheSet(text, vector);
  return vector;
}

module.exports = { embed };
