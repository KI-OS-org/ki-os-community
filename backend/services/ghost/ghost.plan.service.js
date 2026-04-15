/**
 * @file    ghost.plan.service.js
 * @desc    Generiert Ghost Control Step-Sequenzen aus einem User-Ziel via LLM.
 *          Kimba analysiert das Ziel und gibt navigierbare Schritte zurück,
 *          die der GhostExecutor im Frontend ausführt.
 * @author  Ingo Schaffer <ingo@ki-os.org>
 * @coauthor Kimba <kimba@ki-os.org>
 * @license AGPL-3.0-only — https://www.gnu.org/licenses/agpl-3.0.html
 */

'use strict';

const logger = require('../core/logger.service');

// ─── Bekannte data-ghost Selektoren im Frontend ───────────────────────────────
const GHOST_REGISTRY = `
NAVIGATION (CSS: [data-ghost='<key>']):
  nav-home, nav-workspace, nav-agents, nav-jobs, nav-flows, nav-memory,
  nav-integrations, nav-providers, nav-routing, nav-governance, nav-trust,
  nav-control, nav-repair, nav-supervisor, nav-efficiency

AGENTS PAGE:
  new-agent-btn       → "Neuer Agent" Button
  agent-name          → Name-Feld (Input)
  agent-category      → Kategorie (Select)
  agent-prompt        → System Prompt (Textarea)
  agent-save          → Speichern-Button
  agent-edit          → Bearbeiten-Button
  agent-toggle        → Agent aktivieren/deaktivieren

JOBS PAGE:
  new-job-btn, job-name, job-schedule, job-agent, job-save, job-run

FLOWS (DAG):
  new-flow-btn, flow-name, flow-save, flow-execute

ROUTES (für navigate-Steps):
  /agents, /jobs, /flows, /memory, /governance, /trust, /control,
  /repair, /supervisor, /efficiency, /providers, /routing, /workspace,
  /runs          → Agent-Runs und Ausführungshistorie (letzter Run, Run-Details, Run stoppen)
  /connector-galaxy → Connector Galaxy: Übersicht ALLER Konnektoren als visuelle Galaxy-Ansicht
  /demo/swarm   → Swarm Memory Live-Demo: ACO-inspirierter persistenter Wissensspeicher (Canvas-Visualisierung)
  /settings      → Systemeinstellungen (Export, Import, Konfiguration)
`;

// ─── Prompt-Templates ─────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `Du bist KIMBA, die Ghost Control KI von KI-OS.
Deine Aufgabe: Analysiere das Ziel des Users und generiere eine präzise Schritt-Sequenz,
die der Ghost Cursor durch das KI-OS Frontend ausführt.

VERFÜGBARE STEP-TYPEN:
- navigate: { type: "navigate", target: "/route", callout: "Navigiere zu..." }
- spotlight: { type: "spotlight", target: "[data-ghost='key']", callout: "Hier ist..." }
- click:     { type: "click",    target: "[data-ghost='key']", callout: "Klicke auf..." }
- fill:      { type: "fill",     target: "[data-ghost='key']", value: "...", callout: "Trage ein..." }
- speak:     { type: "speak",    callout: "Text den KIMBA erklärt", duration: 2500 }
- wait:      { type: "wait",     duration: 1000, callout: "Kurze Pause..." }
- confirm:   { type: "confirm",  callout: "Bitte bestätige...", requiresConfirmation: true }

BEKANNTE SELEKTOREN:
${GHOST_REGISTRY}

REGELN:
1. Jeder Step MUSS ein "callout" haben (kurze Erklärung auf Deutsch).
2. Vor jedem click/fill: spotlight auf das Element setzen.
3. Steps müssen logisch aufeinander aufbauen.
4. Ziel nicht erreichbar → needsClarification: true mit konkreter Frage.
5. Maximal 10 Steps. Lieber weniger, dafür klar.

ANTWORT-FORMAT (NUR JSON, kein Markdown):
{
  "needsClarification": false,
  "plan": {
    "id": "<uuid>",
    "mode": "demo",
    "title": "<Titel des Ziels>",
    "description": "<1-2 Sätze was KIMBA tut>",
    "steps": [
      {
        "id": "step-1",
        "type": "<step-type>",
        "target": "<selector-or-route>",
        "value": "<optional>",
        "callout": "<Erklärung auf Deutsch>",
        "duration": 1500,
        "requiresConfirmation": false
      }
    ],
    "createdAt": "<ISO timestamp>",
    "sessionId": "<uuid>"
  }
}

ODER bei Unklarheit:
{
  "needsClarification": true,
  "question": "<Konkrete Rückfrage auf Deutsch>"
}`;

// ─── JSON Schema für Structured Outputs (OpenRouter response_format) ──────────
const GHOST_PLAN_SCHEMA = {
  type: 'object',
  properties: {
    needsClarification: { type: 'boolean' },
  },
  required: ['needsClarification'],
  anyOf: [
    {
      properties: {
        needsClarification: { const: false },
        plan: {
          type: 'object',
          properties: {
            id:          { type: 'string' },
            mode:        { enum: ['demo', 'build'] },
            title:       { type: 'string' },
            description: { type: 'string' },
            steps: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id:                   { type: 'string' },
                  type:                 { enum: ['navigate', 'spotlight', 'click', 'fill', 'speak', 'wait', 'confirm'] },
                  target:               { type: 'string' },
                  value:                { type: 'string' },
                  callout:              { type: 'string' },
                  duration:             { type: 'integer' },
                  requiresConfirmation: { type: 'boolean' },
                },
                required: ['id', 'type', 'callout'],
              },
            },
            createdAt: { type: 'string' },
            sessionId: { type: 'string' },
          },
          required: ['id', 'mode', 'title', 'description', 'steps'],
        },
      },
      required: ['plan'],
    },
    {
      properties: {
        needsClarification: { const: true },
        question:           { type: 'string' },
      },
      required: ['question'],
    },
  ],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function genId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function stripMarkdown(text) {
  return String(text || '').replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
}

function parseJson(text) {
  const cleaned = stripMarkdown(text);
  try {
    return JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\{[\s\S]+\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error('Ghost Plan LLM did not return valid JSON');
  }
}

async function callLLM(userPrompt, timeoutMs = 20000) {
  const messages = [{ role: 'user', content: userPrompt }];
  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error(`Ghost Plan LLM timeout after ${timeoutMs}ms`)), timeoutMs)
  );

  // ERSTE WAHL: OpenRouter mit GHOST_PLAN_MODEL (default: Gemini 2.5 Flash Lite)
  // Begründung: Ghost Plan = strukturierter JSON-Output, kurzer Kontext.
  // Gemini 2.5 Flash Lite: <1s, $0.10/1M — schneller und günstiger als Claude Haiku.
  // json_object: erzwingt valides JSON, universeller Support auf OpenRouter (kein json_schema nötig)
  if (process.env.OPENROUTER_API_KEY) {
    const OpenRouter = require('../providers/openrouter.provider');
    const model = process.env.GHOST_PLAN_MODEL || 'google/gemini-2.5-flash-lite';
    const msgs = [{ role: 'system', content: SYSTEM_PROMPT }, ...messages];
    const call = OpenRouter.chat({ model, messages: msgs, temperature: 0.3, response_format: { type: 'json_object' } });
    const res = await Promise.race([call, timeout]);
    return res.text || res.reply || '';
  }

  // FALLBACK: Anthropic Claude Haiku — response_format nicht nativ unterstützt, Prompt-basiert
  if (process.env.ANTHROPIC_API_KEY) {
    const Anthropic = require('../providers/anthropic.provider');
    const model = process.env.MESH_MODEL_FULL || 'claude-haiku-4-5-20251001';
    const call = Anthropic.chat({ model, messages, system: SYSTEM_PROMPT, max_tokens: 1500, temperature: 0.3 });
    const res = await Promise.race([call, timeout]);
    return res.text || res.reply || '';
  }

  // LETZTER FALLBACK: OpenAI gpt-4o-mini — unterstützt response_format json_object nativ
  const OpenAI = require('../providers/openai.provider');
  const call = OpenAI.callOpenAI({
    model: 'gpt-4o-mini',
    messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages],
    temperature: 0.3,
    response_format: { type: 'json_object' },
  });
  const res = await Promise.race([call, timeout]);
  return res.text || res.reply || '';
}

// ─── Service ──────────────────────────────────────────────────────────────────

/**
 * Generiert einen GhostPlan aus einem natürlichsprachlichen Ziel.
 *
 * @param {string} goal    - Das Ziel des Users ("Erstelle einen Agenten")
 * @param {string} [mode]  - 'demo' | 'build' (default: 'demo')
 * @returns {Promise<{ needsClarification: boolean, question?: string, plan?: object }>}
 */
async function generatePlan(goal, mode = 'demo') {
  const sessionId = genId();
  const planId    = `ghost-plan-${genId()}`;

  logger.info('ghost.plan.generate', { goal: goal.slice(0, 100), mode, sessionId });

  const userPrompt = `Ziel des Users: "${goal}"
Modus: ${mode}
Session-ID: ${sessionId}
Plan-ID: ${planId}
Aktueller Zeitstempel: ${new Date().toISOString()}

Generiere jetzt den Ghost Control Plan.`;

  try {
    const raw = await callLLM(userPrompt);
    const result = parseJson(raw);

    // IDs stabilisieren falls LLM sie leer lässt
    if (result.plan) {
      result.plan.id        = result.plan.id        || planId;
      result.plan.sessionId = result.plan.sessionId || sessionId;
      result.plan.mode      = result.plan.mode      || mode;
      result.plan.createdAt = result.plan.createdAt || new Date().toISOString();

      // Step-IDs normalisieren + max 10 Steps erzwingen
      if (Array.isArray(result.plan.steps)) {
        result.plan.steps = result.plan.steps
          .slice(0, 10)
          .map((step, idx) => ({
            ...step,
            id: step.id || `step-${idx + 1}`
          }));
      }
    }

    logger.info('ghost.plan.generated', {
      sessionId,
      needsClarification: result.needsClarification,
      stepCount: result.plan?.steps?.length || 0
    });

    return result;
  } catch (err) {
    try {
      logger.error('ghost.plan.error', { sessionId, error: String(err && err.message || err) });
    } catch (_) { /* logger darf nicht crashen */ }

    // Graceful fallback: bei JEDEM LLM-Fehler (Timeout, Provider, JSON-Parse, ...)
    // kein 500 — stattdessen needsClarification damit Ghost Control nutzbar bleibt
    const msg = String(err && err.message || '');
    const isTimeout = msg.toLowerCase().includes('timeout');
    try {
      logger.warn('ghost.plan.fallback', { sessionId, reason: isTimeout ? 'timeout' : 'llm_error' });
    } catch (_) { /* logger darf nicht crashen */ }

    return {
      needsClarification: true,
      question: isTimeout
        ? 'Die KI antwortet gerade zu langsam. Bitte beschreibe dein Ziel etwas konkreter — was genau soll KIMBA tun?'
        : 'Die KI konnte deinen Plan gerade nicht erstellen. Bitte formuliere dein Ziel konkret — was soll KIMBA genau tun?'
    };
  }
}

// ─── Vision Phase 2: Re-Planning on Vision-Fail ──────────────────────────────

const REPLAN_SYSTEM_PROMPT = `Du bist KIMBA, die Ghost Control KI von KI-OS.
Ein vorheriger Ghost-Step wurde ausgeführt aber die Screenshot-Verifikation hat FEHLGESCHLAGEN.
Deine Aufgabe: Analysiere was schiefgelaufen ist und generiere einen korrigierten Plan.

VERFÜGBARE STEP-TYPEN:
- navigate: { type: "navigate", target: "/route", callout: "Navigiere zu..." }
- spotlight: { type: "spotlight", target: "[data-ghost='key']", callout: "Hier ist..." }
- click:     { type: "click",    target: "[data-ghost='key']", callout: "Klicke auf..." }
- fill:      { type: "fill",     target: "[data-ghost='key']", value: "...", callout: "Trage ein..." }
- speak:     { type: "speak",    callout: "Text den KIMBA erklärt", duration: 2500 }
- wait:      { type: "wait",     duration: 1000, callout: "Kurze Pause..." }
- confirm:   { type: "confirm",  callout: "Bitte bestätige...", requiresConfirmation: true }

BEKANNTE SELEKTOREN:
${GHOST_REGISTRY}

REGELN:
1. Analysiere den fehlgeschlagenen Step und den Vision-Hinweis.
2. Generiere einen alternativen Weg zum gleichen Ziel.
3. Falls unmöglich → needsClarification: true mit Erklärung.
4. Maximal 10 Steps. Lieber kürzer.
5. Jeder Step MUSS ein "callout" haben.

ANTWORT-FORMAT (NUR JSON, kein Markdown): Gleiche Struktur wie der ursprüngliche Plan.`;

/**
 * Vision Phase 2: Re-generiert einen GhostPlan wenn die Vision-Verifikation
 * eines Steps fehlgeschlagen ist. Max. MAX_REPLAN_ATTEMPTS Versuche.
 *
 * @param {object} params
 * @param {string}  params.goal            - Ursprüngliches Ziel
 * @param {string}  params.mode            - 'demo' | 'build'
 * @param {object}  params.originalPlan    - Der ursprüngliche Plan
 * @param {number}  params.failedStepIndex - Index des fehlgeschlagenen Steps (0-basiert)
 * @param {object}  params.visionResult    - { verified: false, description, hint }
 * @param {number}  [params.retryCount=0]  - Wie viele Re-Plans bereits versucht wurden
 * @returns {Promise<{ needsClarification, plan?, question?, retryCount, maxRetries }>}
 */
const MAX_REPLAN_ATTEMPTS = 2;

async function replanOnVisionFail({ goal, mode = 'demo', originalPlan, failedStepIndex, visionResult, retryCount = 0 }) {
  if (!goal || typeof goal !== 'string') throw new Error('goal ist erforderlich');
  if (!originalPlan || !Array.isArray(originalPlan.steps)) throw new Error('originalPlan.steps fehlt');
  if (typeof failedStepIndex !== 'number' || failedStepIndex < 0) throw new Error('failedStepIndex muss ≥ 0 sein');

  const sessionId = genId();
  const planId    = `ghost-replan-${genId()}`;

  // Retry-Limit prüfen
  if (retryCount >= MAX_REPLAN_ATTEMPTS) {
    logger.warn('ghost.replan.limit_reached', { sessionId, retryCount, goal: goal.slice(0, 80) });
    return {
      needsClarification: true,
      question:           'KIMBA konnte den Step nach mehreren Versuchen nicht korrekt ausführen. Bitte überprüfe die Seite manuell oder formuliere das Ziel anders.',
      retryCount,
      maxRetries:         MAX_REPLAN_ATTEMPTS,
    };
  }

  const failedStep  = originalPlan.steps[failedStepIndex];
  const stepsBefore = originalPlan.steps.slice(0, failedStepIndex);
  const visionHint  = visionResult?.hint || visionResult?.description || 'Keine Details verfügbar';

  logger.info('ghost.replan.start', { sessionId, retryCount, goal: goal.slice(0, 80), failedStepIndex });

  const userPrompt = `Ursprüngliches Ziel: "${goal}"
Modus: ${mode}
Session-ID: ${sessionId}
Plan-ID: ${planId}
Aktueller Zeitstempel: ${new Date().toISOString()}

FEHLGESCHLAGENER STEP (Index ${failedStepIndex}):
${JSON.stringify(failedStep, null, 2)}

VISION-VERIFIKATION ERGEBNIS:
- verified: false
- KI-Beschreibung: "${visionResult?.description || 'N/A'}"
- Hinweis: "${visionHint}"

BEREITS ERFOLGREICH AUSGEFÜHRT (${stepsBefore.length} Steps):
${stepsBefore.length > 0 ? stepsBefore.map(s => `- [${s.type}] ${s.callout}`).join('\n') : '(keine)'}

Re-Plan-Versuch: ${retryCount + 1}/${MAX_REPLAN_ATTEMPTS}

Generiere jetzt einen korrigierten Ghost Control Plan ab dem fehlgeschlagenen Step.
Berücksichtige den Vision-Hinweis und wähle einen alternativen Weg.`;

  try {
    const raw    = await callLLM(userPrompt, 20000);
    const result = parseJson(raw);

    if (result.plan) {
      result.plan.id        = result.plan.id        || planId;
      result.plan.sessionId = result.plan.sessionId || originalPlan.sessionId || sessionId;
      result.plan.mode      = result.plan.mode      || mode;
      result.plan.createdAt = result.plan.createdAt || new Date().toISOString();

      if (Array.isArray(result.plan.steps)) {
        result.plan.steps = result.plan.steps
          .slice(0, 10)
          .map((step, idx) => ({ ...step, id: step.id || `replan-step-${idx + 1}` }));
      }
    }

    logger.info('ghost.replan.generated', {
      sessionId,
      retryCount: retryCount + 1,
      needsClarification: result.needsClarification,
      stepCount: result.plan?.steps?.length || 0,
    });

    return {
      ...result,
      retryCount:  retryCount + 1,
      maxRetries:  MAX_REPLAN_ATTEMPTS,
    };

  } catch (err) {
    const msg = String(err?.message || '');
    logger.error('ghost.replan.error', { sessionId, error: msg });

    return {
      needsClarification: true,
      question:           'Der Re-Plan ist fehlgeschlagen. Bitte beschreibe das Ziel nochmals konkret.',
      retryCount:         retryCount + 1,
      maxRetries:         MAX_REPLAN_ATTEMPTS,
    };
  }
}

module.exports = { generatePlan, replanOnVisionFail, MAX_REPLAN_ATTEMPTS };
