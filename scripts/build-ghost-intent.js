/**
 * @file    build-ghost-intent.js
 * @desc    Koordinierter Build: Ghost Control Intent-Integration.
 *          Builder: Gemini 2.5 Flash Lite | Reviewer: DeepSeek V3.1
 * @usage   node scripts/build-ghost-intent.js
 * @author  Koordiniert von Kimba (Head of Engineering)
 */
'use strict';

require('dotenv').config();
const OpenRouter = require('../backend/services/providers/openrouter.provider');

const BUILDER  = 'google/gemini-2.5-flash-lite';
const REVIEWER = 'deepseek/deepseek-chat-v3.1';

const BUILD_SYSTEM = `Du bist ein präziser Code-Agent für KI-OS Backend (Node.js CommonJS).
Regeln:
- Nur den angeforderten Code-Block ausgeben, keine Erklärungen
- Bestehende Code-Konventionen exakt einhalten (gleiche Einrückung, Kommentar-Stil, etc.)
- CommonJS (require/module.exports), kein ES6 import/export
- Variablennamen und Stil des umgebenden Codes übernehmen`;

const REVIEW_SYSTEM = `Du bist Code-Reviewer für KI-OS (Node.js).
Prüfe: Korrektheit, Integration in bestehendes System, Vollständigkeit, Sicherheit.
Antworte NUR als JSON ohne Markdown:
{"approved":true|false,"score":0.0-1.0,"issues":["..."],"summary":"1 Satz"}`;

// ─── Tasks ────────────────────────────────────────────────────────────────────

const TASKS = [
  {
    id: 'intent-types',
    file: 'backend/services/routing/intent.parser.service.js',
    description: 'GHOST_CONTROL zu INTENT_TYPES + SLOT_SCHEMAS + HEURISTIC_RULES hinzufügen',
    context: `Bestehende INTENT_TYPES (Zeile ~33):
const INTENT_TYPES = {
  AGENT_CREATE:      'AGENT_CREATE',
  DAG_EXECUTE:       'DAG_EXECUTE',
  AGENTMESH_RUN:     'AGENTMESH_RUN',
  DOCUMENT_PROCESS:  'DOCUMENT_PROCESS',
  DESKTOP_ACTION:    'DESKTOP_ACTION',
  MEMORY_SEARCH:     'MEMORY_SEARCH',
  CHAT_GENERAL:      'CHAT_GENERAL',
};

Bestehende SLOT_SCHEMAS (Ausschnitt):
const SLOT_SCHEMAS = {
  [INTENT_TYPES.AGENT_CREATE]: [
    { key: 'agentDescription', question: 'Was soll der Agent tun?', required: true },
    ...
  ],
  [INTENT_TYPES.CHAT_GENERAL]: [],
};

Bestehende HEURISTIC_RULES Struktur:
const HEURISTIC_RULES = [
  {
    intentType: INTENT_TYPES.AGENT_CREATE,
    patterns: [ /erstell[e]?\\s+(mir\\s+)?(?:einen?\\s+)?(?:neuen?\\s+)?agent/i, ... ],
    baseConfidence: 0.92,
  },
  ...
];`,
    task: `Gib 3 separate Code-Blöcke aus, die exakt so in die Datei eingefügt werden:

BLOCK 1 — Ergänzung in INTENT_TYPES (neuer Eintrag vor CHAT_GENERAL):
  GHOST_CONTROL: 'GHOST_CONTROL',

BLOCK 2 — Ergänzung in SLOT_SCHEMAS (neuer Eintrag):
  [INTENT_TYPES.GHOST_CONTROL]: [
    { key: 'goalDescription', question: 'Was soll KIMBA dir zeigen oder wo soll ich dich hinführen?', required: true },
    { key: 'mode', question: '', required: false },
  ],

BLOCK 3 — Neuer HEURISTIC_RULE Block (einfügen VOR dem letzten HEURISTIC_RULE Eintrag):
{
    intentType: INTENT_TYPES.GHOST_CONTROL,
    patterns: [
      /zeig[e]?\\s+(mir\\s+)?(?:wie|wo)/i,
      /führ[e]?\\s+(mich|uns)\\s+/i,
      /ghost\\s+control/i,
      /navigier[e]?\\s+(mich|zu)/i,
      /demonstrier[e]?\\s+/i,
      /schritt[\\s-]+für[\\s-]+schritt/i,
      /wie\\s+(?:kann|könnte)\\s+ich\\s+(?:einen?\\s+)?/i,
      /klick[e]?\\s+(auf|mich)/i,
    ],
    baseConfidence: 0.88,
  },`,
    mustContain: ['GHOST_CONTROL', 'goalDescription', 'zeig', 'führ', 'baseConfidence: 0.88']
  },

  {
    id: 'intent-handler',
    file: 'backend/services/routing/intent.router.js',
    description: 'handleGhostControl Handler + HANDLERS-Map Eintrag',
    context: `Bestehender Handler-Stil (handleAgentMeshRun als Referenz):
async function handleAgentMeshRun(intent, ctx, run) {
  const { transitionRun, appendOutput } = require('../ui/runtime.store');
  const task = intent.entities.meshTask || intent.entities.raw || '';
  if (!task) return null;

  try {
    const { startMeshRun } = require('../agentmesh/mesh.runtime.controller');
    transitionRun(run.runId, 'EXECUTING', { stepName: 'agentmesh_dispatch', worker: 'agentmesh' });
    const meshRun = await startMeshRun({ task, ctx });
    appendOutput(run.runId, { type: 'agentmesh_run_started', runId: meshRun.runId });
    transitionRun(run.runId, 'COMPLETED', { stepName: 'agentmesh_dispatched', worker: 'agentmesh' });
    return { success: true, content: '...', meta: { intentType: INTENT_TYPES.AGENTMESH_RUN } };
  } catch (e) {
    logger.warn('intent.router.agentmesh_failed', { error: e.message });
    return null;
  }
}

Bestehende HANDLERS-Map:
const HANDLERS = {
  [INTENT_TYPES.AGENT_CREATE]:  handleAgentCreate,
  [INTENT_TYPES.AGENTMESH_RUN]: handleAgentMeshRun,
};`,
    task: `Gib 2 Code-Blöcke aus:

BLOCK 1 — handleGhostControl Funktion (vollständig):
- goal aus intent.entities.goalDescription || intent.entities.raw
- mode aus intent.entities.mode || 'demo'
- Ruft require('../ghost/ghost.plan.service').generatePlan(goal, mode) auf
- transitionRun: EXECUTING → stepName 'ghost_plan_generate'
- Bei Erfolg: appendOutput mit { type: 'ghost_plan_ready', plan: result.plan, needsClarification: result.needsClarification }
- Bei needsClarification: content = result.question, kein Plan
- Bei Fehler oder fallback: return null (Chat übernimmt)
- logger calls: 'intent.router.ghost_control'

BLOCK 2 — Ergänzung HANDLERS-Map:
  [INTENT_TYPES.GHOST_CONTROL]: handleGhostControl,`,
    mustContain: ['handleGhostControl', 'generatePlan', 'ghost_plan_ready', 'needsClarification', 'GHOST_CONTROL']
  },

  {
    id: 'ghost-model-routing',
    file: 'backend/services/ghost/ghost.plan.service.js',
    description: 'callLLM() — Gemini 2.5 Flash Lite als erste Wahl statt Claude',
    context: `Bestehende callLLM() Funktion:
async function callLLM(userPrompt, timeoutMs = 20000) {
  const messages = [{ role: 'user', content: userPrompt }];
  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error(\`Ghost Plan LLM timeout after \${timeoutMs}ms\`)), timeoutMs)
  );

  // Bevorzuge Anthropic (Qualität für Plan-Generierung)
  if (process.env.ANTHROPIC_API_KEY) {
    const Anthropic = require('../providers/anthropic.provider');
    const model = process.env.MESH_MODEL_FULL || 'claude-haiku-4-5-20251001';
    const call = Anthropic.chat({ model, messages, system: SYSTEM_PROMPT, max_tokens: 1500, temperature: 0.3 });
    const res = await Promise.race([call, timeout]);
    return res.text || res.reply || '';
  }

  // OpenRouter Fallback
  if (process.env.OPENROUTER_API_KEY) {
    const OpenRouter = require('../providers/openrouter.provider');
    const model = process.env.MESH_REVIEWER_MODEL || 'deepseek/deepseek-chat';
    const msgs = [{ role: 'system', content: SYSTEM_PROMPT }, ...messages];
    const call = OpenRouter.chat({ model, messages: msgs, temperature: 0.3 });
    const res = await Promise.race([call, timeout]);
    return res.text || res.reply || '';
  }

  // OpenAI letzter Fallback
  const OpenAI = require('../providers/openai.provider');
  const call = OpenAI.callOpenAI({ model: 'gpt-4o-mini', messages: [...], temperature: 0.3 });
  const res = await Promise.race([call, timeout]);
  return res.text || res.reply || '';
}`,
    task: `Schreibe die vollständige neue callLLM() Funktion.

Neue Reihenfolge (Begründung: Ghost Plan = strukturierter JSON-Output, kurzer Kontext → Speed wichtiger als Top-Qualität):

1. ERSTE WAHL: OpenRouter mit GHOST_PLAN_MODEL env var (default: 'google/gemini-2.5-flash-lite')
   - Schnell (< 1s), günstig ($0.10/1M), gut für strukturierte JSON-Outputs
   - messages: [{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: userPrompt }]

2. FALLBACK: Anthropic Claude Haiku (wenn OpenRouter fehlschlägt)
   - model: process.env.MESH_MODEL_FULL || 'claude-haiku-4-5-20251001'

3. LETZTER FALLBACK: OpenAI gpt-4o-mini

Alle 3 Varianten: Promise.race([call, timeout]) beibehalten.
Kommentar am Anfang der Funktion erklären warum Gemini Flash erste Wahl ist.`,
    mustContain: ['GHOST_PLAN_MODEL', 'gemini-2.5-flash-lite', 'Promise.race', 'FALLBACK', 'Anthropic']
  }
];

// ─── Build + Review ───────────────────────────────────────────────────────────

async function buildTask(task) {
  const prompt = `${task.context}\n\n---\n\nAUFGABE: ${task.task}`;
  const messages = [
    { role: 'system', content: BUILD_SYSTEM },
    { role: 'user',   content: prompt }
  ];
  const t0  = Date.now();
  const res = await OpenRouter.chat({ model: BUILDER, messages, temperature: 0.15 });
  return { text: res.text || res.reply || '', ms: Date.now() - t0 };
}

async function reviewOutput(task, output) {
  const messages = [
    { role: 'system', content: REVIEW_SYSTEM },
    { role: 'user',   content: `Aufgabe: ${task.description}\n\nGenerierter Code:\n${output}` }
  ];
  const res = await OpenRouter.chat({ model: REVIEWER, messages, temperature: 0.1 });
  const raw = (res.text || '{}').replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  try {
    return JSON.parse(raw.match(/\{[\s\S]+\}/)?.[0] || raw);
  } catch {
    return { approved: false, score: 0.5, issues: ['Review parse failed'], summary: 'Manual check needed' };
  }
}

function checkMustContain(output, items) {
  return items.filter(s => !output.includes(s));
}

// ─── Hauptlauf ────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║  Ghost Control Intent Integration                         ║');
  console.log(`║  Builder: ${BUILDER.padEnd(35)}      ║`);
  console.log(`║  Reviewer: ${REVIEWER.padEnd(34)}      ║`);
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  const results = [];

  for (const task of TASKS) {
    console.log(`\n▶ [${task.id}] ${task.description}`);
    console.log(`  File: ${task.file}`);

    const build  = await buildTask(task);
    const review = await reviewOutput(task, build.text);
    const missing = checkMustContain(build.text, task.mustContain);

    const status = review.approved && missing.length === 0 ? '✅ APPROVED'
                 : review.approved && missing.length > 0   ? '⚠️  APPROVED (missing checks)'
                 : '❌ NEEDS REVISION';

    console.log(`  → Build: ${build.ms}ms | Review Score: ${review.score} | ${status}`);
    if (missing.length)    console.log(`  → Missing: ${missing.join(', ')}`);
    if (review.issues?.length) console.log(`  → Issues: ${review.issues.slice(0,2).join(' | ')}`);

    results.push({ task, build, review, missing, status });
  }

  // ─── Output für Kimba-Verifikation ─────────────────────────────────────────

  console.log('\n\n' + '═'.repeat(70));
  console.log('  OUTPUTS — Zur Verifikation durch Kimba (Head of Engineering)');
  console.log('═'.repeat(70));

  for (const r of results) {
    console.log(`\n${'─'.repeat(70)}`);
    console.log(`  TASK: ${r.task.id} → ${r.task.file}`);
    console.log(`  Status: ${r.status} | Score: ${r.review.score} | ${r.review.summary}`);
    console.log('─'.repeat(70));
    console.log(r.build.text);
  }

  const allApproved = results.every(r => r.review.approved);
  console.log('\n' + '═'.repeat(70));
  console.log(allApproved
    ? '✅ ALLE TASKS APPROVED — Kimba: bitte Outputs verifizieren und apply geben'
    : '⚠️  NICHT ALLE APPROVED — Kimba: Issues prüfen vor Apply');
  console.log('═'.repeat(70) + '\n');
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
