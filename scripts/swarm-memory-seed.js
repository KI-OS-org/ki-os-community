/**
 * @file    swarm-memory-seed.js
 * @desc    Initiales Seeding des KI-OS Swarm Memory mit bewährten Patterns,
 *          Entscheidungen und Antipatterns aus den Sprints v1.2–v1.4.
 *          Einmalig ausführen: node scripts/swarm-memory-seed.js
 * @author  Ingo Schaffer <ingo@ki-os.org>
 * @coauthor Kimba <kimba@ki-os.org>
 * @license AGPL-3.0-only — https://www.gnu.org/licenses/agpl-3.0.html
 */

'use strict';

const path        = require('path');
const swarmMemory = require('../backend/services/memory/swarm.memory');

// ─── Seed-Daten ───────────────────────────────────────────────────────────────

const PATTERNS = [
  // ── Architektur ──────────────────────────────────────────────────────────────
  {
    text: 'KI-OS Backend verwendet ausschließlich CommonJS (require/module.exports). Kein ESM (import/export) im Backend-Code.',
    metadata: { type: 'pattern', author: 'claude', sprint: 'v1.2', category: 'architecture' }
  },
  {
    text: 'Provider-Auflösung immer lazy via require() innerhalb der Funktion, nicht auf Modul-Level. Vermeidet Fehler wenn API-Keys fehlen.',
    metadata: { type: 'pattern', author: 'claude', sprint: 'v1.2', category: 'architecture' }
  },
  {
    text: 'Alle Backend-Services exportieren eine klare API: named exports, kein default export. Beispiel: module.exports = { store, retrieve, feedback }.',
    metadata: { type: 'pattern', author: 'claude', sprint: 'v1.2', category: 'architecture' }
  },
  {
    text: 'Logger immer mit try/catch laden: try { logger = require(...) } catch { logger = { info: ()=>{}, warn: ()=>{}, error: ()=>{} } }. Verhindert Crashes in Test-Umgebungen.',
    metadata: { type: 'pattern', author: 'claude', sprint: 'v1.3', category: 'resilience' }
  },

  // ── Multi-Agent Pipeline ──────────────────────────────────────────────────────
  {
    text: 'Score-Gate für Swarm Memory Writes: patterns nur bei review.score >= 0.90, antipatterns nur bei score <= 0.65. Verhindert mittelmäßige Einträge.',
    metadata: { type: 'decision', author: 'claude', sprint: 'v1.4', category: 'swarm-memory' }
  },
  {
    text: 'Qwen 2.5 72B = Builder-Agent für Code-Generierung. DeepSeek V3 = Reviewer. Claude = Architekt und Verifikation. Rollen nicht mischen.',
    metadata: { type: 'decision', author: 'claude', sprint: 'v1.3', category: 'multi-agent' }
  },
  {
    text: 'response_format: { type: "json_object" } bei jedem LLM-Call der strukturiertes JSON erwartet. Universeller Support auf OpenRouter.',
    metadata: { type: 'pattern', author: 'claude', sprint: 'v1.3', category: 'llm-integration' }
  },
  {
    text: 'LLM-Timeouts immer mit Promise.race() implementieren. Default: 20000ms für Ghost Plan, 30000ms für komplexe Build-Tasks.',
    metadata: { type: 'pattern', author: 'claude', sprint: 'v1.3', category: 'resilience' }
  },
  {
    text: 'LLM-Timeout Fallback: needsClarification: true zurückgeben statt Error werfen. User sieht hilfreiche Frage, nicht 500.',
    metadata: { type: 'pattern', author: 'claude', sprint: 'v1.5', category: 'resilience' }
  },

  // ── Testing ───────────────────────────────────────────────────────────────────
  {
    text: 'Test-Isolation für Module mit module-level State (_cache): require.cache invalidieren + eindeutigen tmpPath setzen vor jedem Test.',
    metadata: { type: 'pattern', author: 'claude', sprint: 'v1.4', category: 'testing' }
  },
  {
    text: 'Node.js built-in Test-Runner (node:test + assert) verwenden. Kein Jest, kein Mocha. Zero Dependencies für Tests.',
    metadata: { type: 'decision', author: 'claude', sprint: 'v1.4', category: 'testing' }
  },
  {
    text: 'Score-Gate Logik als pure Funktion in Test-Datei extrahieren und isoliert testen statt die ganze agent.js zu mocken.',
    metadata: { type: 'pattern', author: 'claude', sprint: 'v1.4', category: 'testing' }
  },

  // ── Security ──────────────────────────────────────────────────────────────────
  {
    text: 'Vor jedem GitHub Push: github-safe-push.js ausführen (Blocked Files + Enterprise Patterns + Secret Content Scan).',
    metadata: { type: 'pattern', author: 'claude', sprint: 'v1.4', category: 'security' }
  },
  {
    text: 'gitleaks .toml Config (/.gitleaks.toml) gehört in ALLOWED_FILES Whitelist — ist ein Scanner-Config, kein Secret.',
    metadata: { type: 'decision', author: 'claude', sprint: 'v1.4', category: 'security' }
  },
  {
    text: 'sed mit | als Delimiter statt / bei API-Key-Replacements in Setup-Scripts. Verhindert Fehler wenn Keys / enthalten.',
    metadata: { type: 'pattern', author: 'claude', sprint: 'v1.4', category: 'devops' }
  },

  // ── ACO / Swarm Memory ───────────────────────────────────────────────────────
  {
    text: 'Swarm Memory ACO-Parameter: DECAY_LAMBDA=0.05 (Pheromon-Verdunstung pro Tag), INITIAL_CONFIDENCE=0.70, FEEDBACK_BOOST=0.15.',
    metadata: { type: 'decision', author: 'claude', sprint: 'v1.4', category: 'swarm-memory' }
  },
  {
    text: 'Swarm Memory Deduplizierung via SHA1-Hash der ersten 12 Zeichen. Gleicher Text → Update statt neuer Eintrag.',
    metadata: { type: 'pattern', author: 'claude', sprint: 'v1.4', category: 'swarm-memory' }
  },

  // ── Frontend ─────────────────────────────────────────────────────────────────
  {
    text: 'KI-OS Frontend: Next.js App Router, TypeScript, Tailwind. CSS-Variablen: --accent (cyan), --muted-foreground. Klassen-Präfix: cn() utility.',
    metadata: { type: 'pattern', author: 'claude', sprint: 'v1.2', category: 'frontend' }
  },
  {
    text: 'Navigation-Items via navigationSections aus @/lib/navigation. Neue Seiten dort eintragen, nicht hardcoded in Sidebar.',
    metadata: { type: 'pattern', author: 'claude', sprint: 'v1.3', category: 'frontend' }
  },

  // ── Ghost Control ─────────────────────────────────────────────────────────────
  {
    text: 'Ghost Control Steps immer mit data-ghost Attributen selektieren (nicht CSS-Klassen). Beispiel: [data-ghost="new-agent-btn"].',
    metadata: { type: 'pattern', author: 'claude', sprint: 'v1.3', category: 'ghost-control' }
  },
  {
    text: 'Ghost Plan: Vor click/fill immer spotlight-Step setzen. Maximal 10 Steps. Callout auf Deutsch ist Pflicht.',
    metadata: { type: 'pattern', author: 'claude', sprint: 'v1.3', category: 'ghost-control' }
  },
];

const ANTIPATTERNS = [
  {
    text: 'NIEMALS Datenbank in Unit-Tests mocken. Integration Tests müssen gegen echte DB laufen.',
    metadata: { type: 'antipattern', found_by: 'deepseek', sprint: 'v1.3', category: 'testing' }
  },
  {
    text: 'NIEMALS alert() in UI-Komponenten für Benutzer-Feedback. Immer API-Call + State (busy/feedback).',
    metadata: { type: 'antipattern', found_by: 'deepseek', sprint: 'v1.4', category: 'frontend' }
  },
  {
    text: 'NIEMALS eval() oder Function() Constructor für dynamischen Code. Immer explizite Implementierung.',
    metadata: { type: 'antipattern', found_by: 'deepseek', sprint: 'v1.2', category: 'security' }
  },
  {
    text: 'NIEMALS require() auf Modul-Level für optionale Provider (OpenRouter, Anthropic). Immer lazy inside function.',
    metadata: { type: 'antipattern', found_by: 'deepseek', sprint: 'v1.2', category: 'architecture' }
  },
  {
    text: 'NIEMALS .env oder .env.* ins Git-Repo committen. Immer in .gitignore und github-safe-push.js BLOCKED_FILES.',
    metadata: { type: 'antipattern', found_by: 'claude', sprint: 'v1.4', category: 'security' }
  },
  {
    text: 'NIEMALS Promises ohne Timeout-Race für externe LLM-Calls. Jeder LLM-Call braucht Promise.race([call, timeout]).',
    metadata: { type: 'antipattern', found_by: 'deepseek', sprint: 'v1.3', category: 'resilience' }
  },
];

// ─── Seed ausführen ───────────────────────────────────────────────────────────

function seed() {
  const stats = swarmMemory.getStats();
  console.log(`\n[Swarm Memory Seed] Aktueller Stand: ${stats.total} Einträge\n`);

  let created = 0;
  let updated = 0;

  for (const item of [...PATTERNS, ...ANTIPATTERNS]) {
    const result = swarmMemory.store(item.text, item.metadata);
    if (result.created) created++;
    if (result.updated) updated++;
  }

  const after = swarmMemory.getStats();
  console.log(`[Swarm Memory Seed] Fertig!`);
  console.log(`  Neu:        ${created}`);
  console.log(`  Aktualisiert: ${updated}`);
  console.log(`  Gesamt jetzt: ${after.total} Einträge`);
  console.log(`  Typen:`, after.byType);
  console.log(`  Avg Confidence: ${after.avgConfidence}`);
  console.log(`  DB Path: ${after.dbPath}\n`);
}

seed();
