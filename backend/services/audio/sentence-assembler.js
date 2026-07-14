/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
// (c) 2026 KI-OS.org by Ingo Schaffer und Kimba — AGPL-3.0-only
// @desc Satz-Assembler — baut aus Wortschatz-MP3s natürliche Sätze zusammen (via ffmpeg)

'use strict';

const path = require('path');
const fs   = require('fs');
const os   = require('os');
const { execSync } = require('child_process');
const { wordToFilename, CHARACTER_VOICES } = require('./voice-vocab');

const DEMO_BASE = path.join(process.cwd(), 'DEMO', 'audio');

// Kein Silence-Gap — direkte Schnitte klingen flüssiger; loudnorm gleicht Pegel aus
const WORD_GAP_MS = 0;

// Mehrwort-Phrasen aus dem Vocab (müssen vor Split erkannt werden)
const MULTI_WORD_PHRASES = ['Guten Morgen', 'Guten Tag', 'Auf Wiedersehen'];

// ─── Tokenizer ────────────────────────────────────────────────────────────────
// Erkennt zuerst Mehrwort-Phrasen, dann einzelne Wörter
function tokenize(text) {
  let remaining = text.replace(/[.,!?;:]/g, '');
  const tokens = [];
  while (remaining.trim()) {
    let matched = false;
    for (const phrase of MULTI_WORD_PHRASES) {
      if (remaining.trimStart().toLowerCase().startsWith(phrase.toLowerCase())) {
        tokens.push(phrase);
        remaining = remaining.trimStart().slice(phrase.length);
        matched = true;
        break;
      }
    }
    if (!matched) {
      const word = remaining.trimStart().match(/^\S+/)?.[0] || '';
      if (word) { tokens.push(word); remaining = remaining.trimStart().slice(word.length); }
      else break;
    }
  }
  return tokens.filter(Boolean);
}

// ─── Vocab-Dateipfad prüfen ───────────────────────────────────────────────────
function findVocabFile(character, word) {
  const p = path.join(DEMO_BASE, 'de', character, 'vocab', wordToFilename(word));
  return fs.existsSync(p) ? p : null;
}

// ─── Stille-PCM generieren (WAV) ─────────────────────────────────────────────
function silenceWav(ms, tmpDir) {
  const samples = Math.floor((24000 * ms) / 1000);
  const pcm = Buffer.alloc(samples * 2, 0); // 16-bit silence
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write('WAVE', 8); header.write('fmt ', 12);
  header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22); header.writeUInt32LE(24000, 24);
  header.writeUInt32LE(48000, 28); header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34); header.write('data', 36);
  header.writeUInt32LE(pcm.length, 40);
  const out = path.join(tmpDir, `silence_${ms}ms.wav`);
  fs.writeFileSync(out, Buffer.concat([header, pcm]));
  return out;
}

// ─── ffmpeg: Dateien verketten → MP3 ─────────────────────────────────────────
function ffmpegConcat(filePaths, outputPath) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kimba-asm-'));
  try {
    const listFile = path.join(tmpDir, 'concat.txt');
    const lines = filePaths.map(f => `file '${f.replace(/'/g, "'\\''")}'`).join('\n');
    fs.writeFileSync(listFile, lines);
    // Wörter hart aneinanderschneiden + Lautstärke normieren für flüssigen Klang
    execSync(
      `ffmpeg -y -f concat -safe 0 -i "${listFile}" -af "loudnorm=I=-16:TP=-1.5:LRA=11" "${outputPath}"`,
      { stdio: 'pipe', timeout: 30000 }
    );
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

// ─── Haupt-API ────────────────────────────────────────────────────────────────

/**
 * Versucht, einen Satz aus Vokabel-MP3s zusammenzusetzen.
 * Gibt { success, audioPath, missing } zurück.
 * Bei fehlendem Wort → success: false, missing enthält fehlende Wörter.
 */
function assemble(text, character, outputPath) {
  const tokens = tokenize(text);
  const files = [];
  const missing = [];
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kimba-sil-'));

  try {
    const silFile = silenceWav(WORD_GAP_MS, tmpDir);

    for (let i = 0; i < tokens.length; i++) {
      const vocabFile = findVocabFile(character, tokens[i]);
      if (!vocabFile) {
        missing.push(tokens[i]);
      } else {
        if (files.length > 0) files.push(silFile);
        files.push(vocabFile);
      }
    }

    if (missing.length > 0) return { success: false, missing, audioPath: null };

    ffmpegConcat(files, outputPath);
    return { success: true, missing: [], audioPath: outputPath };
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

/**
 * Prüft, wie viele Tokens eines Satzes im Vokabular vorhanden sind.
 * Gibt { coverage, total, found, missing } zurück.
 */
function coverage(text, character) {
  const tokens = tokenize(text);
  const found = tokens.filter(t => findVocabFile(character, t) !== null);
  const missing = tokens.filter(t => findVocabFile(character, t) === null);
  return {
    coverage: tokens.length === 0 ? 0 : found.length / tokens.length,
    total: tokens.length,
    found: found.length,
    missing,
  };
}

module.exports = { assemble, coverage, tokenize };
