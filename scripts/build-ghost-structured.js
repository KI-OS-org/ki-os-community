/**
 * @file    build-ghost-structured.js
 * @desc    Delegierter Build: Structured Outputs für Ghost Control.
 *          Builder: Gemini 2.5 Flash Lite | Reviewer: DeepSeek V3.1
 *          Aufgabe: response_format JSON Schema Enforcement in ghost.plan.service.js
 *          + openrouter.provider.js chat() erweitern.
 * @usage   node scripts/build-ghost-structured.js
 * @author  Koordiniert von Kimba (Head of Engineering)
 * @coauthor Kimba <kimba@ki-os.org>
 * @license AGPL-3.0-only — https://www.gnu.org/licenses/agpl-3.0.html
 */
'use strict';

require('dotenv').config();
const OpenRouter = require('../backend/services/providers/openrouter.provider');

const BUILDER  = 'google/gemini-2.5-flash-lite';
const REVIEWER = 'deepseek/deepseek-chat-v3.1';

const BUILD_SYSTEM = `Du bist ein präziser Code-Agent für KI-OS Backend (Node.js CommonJS).
Regeln:
- Nur den angeforderten Code ausgeben, keine Erklärungen außer inline-Kommentare
- Bestehende Code-Konventionen exakt einhalten (Einrückung: 2 Spaces, CommonJS require/module.exports)
- Variablennamen und Stil des umgebenden Codes übernehmen
- Kein ES6 import/export
- Jede neue Datei bekommt diesen Header:
  /**
   * @file    DATEINAME.js
   * @desc    KONKRETER ZWECK (1-2 Sätze)
   * @author  Ingo Schaffer <ingo@ki-os.org>
   * @coauthor Kimba <kimba@ki-os.org>
   * @license AGPL-3.0-only — https://www.gnu.org/licenses/agpl-3.0.html
   */`;

const REVIEW_SYSTEM = `Du bist Code-Reviewer für KI-OS (Node.js).
Prüfe: Korrektheit, Rückwärtskompatibilität, Integration in bestehendes System, Sicherheit.
WICHTIG: Imports wie logger, INTENT_TYPES, transitionRun etc. sind bereits im umgebenden Code definiert —
flagge diese NICHT als fehlend. Nur echte Fehler im gelieferten Code-Block flaggen.
Antworte NUR als JSON ohne Markdown:
{"approved":true|false,"score":0.0-1.0,"issues":["..."],"summary":"1 Satz"}`;

// ─── Tasks ────────────────────────────────────────────────────────────────────

const TASKS = [

  // ─── Task 1: GhostPlan JSON Schema + response_format in openrouter.provider ──
  {
    id: 'openrouter-response-format',
    file: 'backend/services/providers/openrouter.provider.js',
    description: 'openrouter.provider.js chat() — optionales response_format Parameter hinzufügen',
    context: `Bestehende chat() Funktion in openrouter.provider.js (Zeile 11-23):

async function chat({ messages, model, temperature }) {
    try {
        const res = await axios.post('https://openrouter.ai/api/v1/chat/completions',
            { model, messages, temperature },
            { headers: { 'Authorization': \`Bearer \${process.env.OPENROUTER_API_KEY}\` } }
        );
        Observability.recordProviderCall('openrouter', { model, api: 'chat.completions' });
        return { text: res.data.choices[0].message.content, meta: { provider: 'openrouter', model } };
    } catch (e) {
        Observability.recordProviderFailure('openrouter', e, { model, api: 'chat.completions' });
        throw e;
    }
}

WICHTIG: Nur die chat() Funktion ausgeben — nicht die ganzen anderen Funktionen in der Datei.`,
    task: `Schreibe NUR die neue chat() Funktion (vollständig, keine anderen Funktionen).

Änderungen:
1. Parameter erweitern: chat({ messages, model, temperature, response_format })
2. Im axios.post payload: response_format NUR hinzufügen wenn es übergeben wurde (kein undefined im Body)
   Beispiel: const payload = { model, messages, temperature };
             if (response_format) payload.response_format = response_format;
3. Alles andere IDENTISCH lassen (Observability Calls, Error Handling, return)

Das ist eine nicht-breaking Änderung — bestehende Aufrufe ohne response_format funktionieren weiter.`,
    mustContain: ['response_format', 'payload', 'Observability.recordProviderCall']
  },

  // ─── Task 2: GHOST_PLAN_SCHEMA + callLLM in ghost.plan.service.js ─────────────
  {
    id: 'ghost-structured-outputs',
    file: 'backend/services/ghost/ghost.plan.service.js',
    description: 'ghost.plan.service.js — GHOST_PLAN_SCHEMA definieren + callLLM mit response_format',
    context: `Bestehende callLLM() Funktion (Zeile 117-153):

async function callLLM(userPrompt, timeoutMs = 20000) {
  const messages = [{ role: 'user', content: userPrompt }];
  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error(\`Ghost Plan LLM timeout after \${timeoutMs}ms\`)), timeoutMs)
  );

  // ERSTE WAHL: OpenRouter mit GHOST_PLAN_MODEL (default: Gemini 2.5 Flash Lite)
  if (process.env.OPENROUTER_API_KEY) {
    const OpenRouter = require('../providers/openrouter.provider');
    const model = process.env.GHOST_PLAN_MODEL || 'google/gemini-2.5-flash-lite';
    const msgs = [{ role: 'system', content: SYSTEM_PROMPT }, ...messages];
    const call = OpenRouter.chat({ model, messages: msgs, temperature: 0.3 });
    const res = await Promise.race([call, timeout]);
    return res.text || res.reply || '';
  }

  // FALLBACK: Anthropic Claude Haiku
  if (process.env.ANTHROPIC_API_KEY) {
    const Anthropic = require('../providers/anthropic.provider');
    const model = process.env.MESH_MODEL_FULL || 'claude-haiku-4-5-20251001';
    const call = Anthropic.chat({ model, messages, system: SYSTEM_PROMPT, max_tokens: 1500, temperature: 0.3 });
    const res = await Promise.race([call, timeout]);
    return res.text || res.reply || '';
  }

  // LETZTER FALLBACK: OpenAI
  const OpenAI = require('../providers/openai.provider');
  const call = OpenAI.callOpenAI({
    model: 'gpt-4o-mini',
    messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages],
    temperature: 0.3
  });
  const res = await Promise.race([call, timeout]);
  return res.text || res.reply || '';
}

Bekannte GhostPlan Output-Struktur (aus SYSTEM_PROMPT):
{
  "needsClarification": false,
  "plan": {
    "id": "string",
    "mode": "demo|build",
    "title": "string",
    "description": "string",
    "steps": [
      {
        "id": "step-N",
        "type": "navigate|spotlight|click|fill|speak|wait|confirm",
        "target": "string (optional)",
        "value": "string (optional)",
        "callout": "string",
        "duration": 1500,
        "requiresConfirmation": false
      }
    ],
    "createdAt": "ISO timestamp",
    "sessionId": "string"
  }
}
ODER:
{ "needsClarification": true, "question": "string" }`,
    task: `Gib 2 Code-Blöcke aus:

BLOCK 1 — GHOST_PLAN_SCHEMA Konstante (als const, VOR callLLM, in den Helpers-Abschnitt nach stripMarkdown/parseJson):
- JSON Schema Definition für den GhostPlan Output
- Muss beide Fälle abdecken: needsClarification=true und needsClarification=false
- Verwende anyOf für die zwei Varianten
- Halte es minimal aber korrekt (kein overconstrained Schema)
- Kommentar: "// ─── JSON Schema für Structured Outputs (OpenRouter response_format) ──────────"

BLOCK 2 — Neue callLLM() Funktion (vollständig, ersetzt die bestehende):
- OpenRouter-Call bekommt response_format: { type: 'json_object' } — KEIN volles json_schema (nicht alle Modelle supporten das)
  Warum json_object: universeller Support, erzwingt valides JSON ohne Parsing-Fehler
- Anthropic-Call bleibt unverändert (Anthropic Haiku supportet response_format nicht nativ)
- OpenAI-Call bekommt response_format: { type: 'json_object' } — gpt-4o-mini supportet das
- Kommentar beim OpenRouter-Call: "// json_object: erzwingt valides JSON, universeller Support auf OpenRouter"
- Alle anderen Aspekte (timeout, fallback-Logik, Promise.race) IDENTISCH lassen`,
    mustContain: ['GHOST_PLAN_SCHEMA', 'anyOf', 'response_format', 'json_object', 'Promise.race']
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
  console.log('║  Ghost Control — Structured Outputs Build                 ║');
  console.log(`║  Builder:  ${BUILDER.padEnd(34)}      ║`);
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
    if (missing.length)       console.log(`  → Missing keywords: ${missing.join(', ')}`);
    if (review.issues?.length) console.log(`  → Issues: ${review.issues.slice(0, 2).join(' | ')}`);
    console.log(`  → Summary: ${review.summary}`);

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
  const totalMs = results.reduce((s, r) => s + r.build.ms, 0);
  console.log('\n' + '═'.repeat(70));
  console.log(`  Build Zeit gesamt: ${totalMs}ms`);
  console.log(allApproved
    ? '✅ ALLE TASKS APPROVED — Kimba: bitte Outputs verifizieren und apply geben'
    : '⚠️  NICHT ALLE APPROVED — Kimba: Issues prüfen vor Apply');
  console.log('═'.repeat(70) + '\n');
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
