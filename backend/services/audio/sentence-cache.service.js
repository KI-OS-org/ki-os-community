/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
// (c) 2026 KI-OS.org by Ingo Schaffer und Kimba — AGPL-3.0-only
// @desc Satz-Cache — LanceDB Vektor-Speicher für KI-generierte Sätze pro Charakter

'use strict';

const path   = require('path');
const fs     = require('fs');
const crypto = require('crypto');

let lancedb = null;
try { lancedb = require('@lancedb/lancedb'); } catch {}

const { embed } = require('../memory/embedding.service');
const { assemble } = require('./sentence-assembler');
const tts = require('./tts.service');

const LANCEDB_PATH = path.join(process.cwd(), '.ki-os-audio-cache-lancedb');
const TABLE_NAME   = 'voice_sentences';
const SIMILARITY_THRESHOLD = 0.92;
const DEMO_BASE    = path.join(process.cwd(), 'DEMO', 'audio');

let _db    = null;
let _table = null;
let _ready = false;

function _sha1(text) {
  return crypto.createHash('sha1').update(String(text).trim()).digest('hex').slice(0, 12);
}

function _cosineSimilarity(a, b) {
  if (!a?.length || !b?.length || a.length !== b.length) return 0;
  let dot = 0, nA = 0, nB = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; nA += a[i] ** 2; nB += b[i] ** 2; }
  return nA && nB ? dot / (Math.sqrt(nA) * Math.sqrt(nB)) : 0;
}

async function _init() {
  if (_ready || !lancedb) return;
  try {
    _db = await lancedb.connect(LANCEDB_PATH);
    const tables = await _db.tableNames();
    if (tables.includes(TABLE_NAME)) {
      _table = await _db.openTable(TABLE_NAME);
    } else {
      // Dummy-Eintrag zum Schema-Aufbau
      const dummy = await embed('init');
      _table = await _db.createTable(TABLE_NAME, [{
        id: 'init', text: '', character: '', mood: 'neutral', lang: 'de',
        file_path: '', created_at: Date.now(), vector: dummy,
      }]);
      await _table.delete("id = 'init'");
    }
    _ready = true;
  } catch (e) {
    // LanceDB nicht verfügbar — Fallback-Modus (kein Cache)
    _ready = false;
  }
}

/**
 * Sucht einen semantisch ähnlichen Satz im Cache.
 * Gibt { hit: true, filePath, score } oder { hit: false } zurück.
 */
async function lookup(text, character, mood = 'neutral', lang = 'de') {
  await _init();
  if (!_ready || !_table) return { hit: false };
  try {
    const vec = await embed(text);
    const results = await _table
      .vectorSearch(vec)
      .where(`character = '${character}' AND lang = '${lang}'`)
      .limit(5)
      .toArray();

    for (const row of results) {
      const score = _cosineSimilarity(vec, Array.from(row.vector));
      if (score >= SIMILARITY_THRESHOLD && fs.existsSync(row.file_path)) {
        return { hit: true, filePath: row.file_path, score, text: row.text };
      }
    }
  } catch {}
  return { hit: false };
}

/**
 * Speichert einen Satz + Audiodatei im Cache.
 */
async function store(text, character, filePath, { mood = 'neutral', lang = 'de' } = {}) {
  await _init();
  if (!_ready || !_table) return false;
  try {
    const vec = await embed(text);
    await _table.add([{
      id: `${character}_${_sha1(text)}`,
      text, character, mood, lang,
      file_path: filePath,
      created_at: Date.now(),
      vector: vec,
    }]);
    return true;
  } catch { return false; }
}

/**
 * Vollständige Pipeline:
 * 1. Cache-Lookup
 * 2. Assembler (Wort-für-Wort)
 * 3. TTS Fallback
 * 4. Ergebnis in Cache speichern
 *
 * Gibt { audioPath, source: 'cache'|'assembler'|'tts' } zurück.
 */
async function synthesizeSentence(text, character, { mood = 'neutral', lang = 'de' } = {}) {
  // 1. Cache
  const cached = await lookup(text, character, mood, lang);
  if (cached.hit) return { audioPath: cached.filePath, source: 'cache', score: cached.score };

  const outDir = path.join(DEMO_BASE, lang, character, 'sentences');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `${_sha1(text)}.mp3`);

  // 2. Assembler
  const asm = assemble(text, character, outPath);
  if (asm.success) {
    await store(text, character, outPath, { mood, lang });
    return { audioPath: outPath, source: 'assembler', missing: [] };
  }

  // 3. TTS Fallback
  try {
    const audioBuffer = await tts.synthesize(text, { mood, lang });
    if (audioBuffer) {
      fs.writeFileSync(outPath, audioBuffer);
      await store(text, character, outPath, { mood, lang });
      return { audioPath: outPath, source: 'tts', missing: asm.missing };
    }
  } catch {}

  return { audioPath: null, source: 'error', missing: asm.missing };
}

module.exports = { lookup, store, synthesizeSentence };
