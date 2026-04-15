/**
 * KI-OS — (C) 2026 Ingo Schaffer
 * https://ki-os.org
 */
/**
 * KI-OS SelfRepair Classifier
 * Klassifiziert Server-Fehler in Level 1 (kritisch), 2 (Night-Slot), 3 (nächstes Release).
 */
'use strict';

// ---------------------------------------------------------------------------
// Level-1 Patterns — sofortige Reaktion
// ---------------------------------------------------------------------------
const L1_PATTERNS = [
  // Kompletter Crash / ungültiger Zustand
  /cannot read prop/i,
  /cannot set prop/i,
  /is not a function/i,
  /undefined is not/i,
  /ECONNREFUSED/,
  /EADDRINUSE/,
  /FATAL/,
  /out of memory/i,
  /heap out of memory/i,
  /process\.exit/,
  // Auth / Sicherheit komplett ausgefallen
  /assertRole.*failed/i,
  /pki.*failed/i,
  /authentication.*unavailable/i,
  // Speicher-Adapter komplett down
  /memory.*adapter.*failed/i,
  /store.*corrupted/i,
  /ENOENT.*\.ki-os/,
];

// ---------------------------------------------------------------------------
// Level-2 Patterns — Night-Slot (nicht kritisch, aber wiederkehrend)
// ---------------------------------------------------------------------------
const L2_PATTERNS = [
  /timeout/i,
  /ETIMEDOUT/,
  /rate.?limit/i,
  /503/,
  /502/,
  /degraded/i,
  /provider.*failed/i,
  /retry/i,
  /circuit.*open/i,
  /slow.*query/i,
  /ECONNRESET/,
];

// ---------------------------------------------------------------------------
// Kritische Services: Fehler dort → immer mindestens L2
// ---------------------------------------------------------------------------
const CRITICAL_SERVICES = [
  '/chat', '/memory', '/auth', '/health', '/agents',
  'chat.controller', 'memory.controller', 'pki', 'rate-limit',
];

// ---------------------------------------------------------------------------
// Classify
// ---------------------------------------------------------------------------
function classify({ error = '', stack = '', source = '', context = {} }) {
  const text = `${error} ${stack}`.toLowerCase();

  // Explizites Level aus context (überschreibt alles)
  if (context.forceLevel) return Number(context.forceLevel);

  // L1 Pattern Match
  for (const pattern of L1_PATTERNS) {
    if (pattern.test(text)) return 1;
  }

  // Kritischer Service + beliebiger Fehler → L2 mindestens
  const isCriticalSource = CRITICAL_SERVICES.some(s =>
    source.toLowerCase().includes(s.toLowerCase())
  );

  // L2 Pattern Match
  for (const pattern of L2_PATTERNS) {
    if (pattern.test(text)) return isCriticalSource ? 1 : 2;
  }

  // Kritischer Service aber unbekannter Fehler → L2
  if (isCriticalSource) return 2;

  // Alles andere → L3
  return 3;
}

// ---------------------------------------------------------------------------
// Extrahiert den wahrscheinlich betroffenen Quell-Dateipfad aus dem Stack
// ---------------------------------------------------------------------------
function extractAffectedFile(stack = '') {
  if (!stack) return null;
  const lines = stack.split('\n');
  for (const line of lines) {
    // Suche nach KI-OS eigenen Dateien (nicht node_modules)
    const m = line.match(/\((.+\.js):\d+:\d+\)/) || line.match(/at (.+\.js):\d+:\d+/);
    if (m && m[1] && !m[1].includes('node_modules') && !m[1].includes('internal/')) {
      return m[1];
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Menschenlesbarer Titel für ein Incident
// ---------------------------------------------------------------------------
function summarize({ level, error, source }) {
  const prefix = level === 1 ? '[L1 KRITISCH]' : level === 2 ? '[L2 Night-Slot]' : '[L3 Backlog]';
  const msg = (error || '').slice(0, 80);
  return `${prefix} ${source || 'unknown'}: ${msg}`;
}

module.exports = { classify, extractAffectedFile, summarize };
