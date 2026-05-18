/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
/**
 * KI-OS — (C) 2026 Ingo Schaffer
 * https://ki-os.org
 * @license AGPL-3.0-only
 */
/**
 * (c) 2026 KI-OS.org — Simulations Controller
 * Kimba Moment + Connector Galaxy · Claude Haiku
 */
'use strict';
const axios = require('../core/http.client');
const { isEnterprise } = require('../blauer-elefant/edition.guard');

function enterpriseOnly(fn) {
  return async function(req, res, ...args) {
    if (!isEnterprise()) {
      const resp = {
        error: 'ENTERPRISE_REQUIRED',
        message: 'Diese Funktion erfordert eine KI-OS Enterprise Edition.',
        info: 'https://ki-os.org/enterprise',
      };
      if (res && typeof res.status === 'function') return res.status(403).json(resp);
      return { statusCode: 403, body: resp };
    }
    return fn(req, res, ...args);
  };
}

/* ─────────────────────────────────────────
   KIMBA MOMENT — Pipeline-Analyse
───────────────────────────────────────── */
const KIMBA_PROMPT = `Du bist der KI-OS Kern. Analysiere die Business-Frage und beschreibe was jede Pipeline-Stufe konkret tut. Gib NUR valides JSON zurück, kein Markdown.

Format:
{
  "question_display": "Gekürzte Frage max 58 Zeichen",
  "stages": {
    "intent":    {"label":"Typ max 22 Zeichen","detail":"Was erkannt, max 42 Zeichen","category":"controlling|strategy|marketing|hr|compliance|research"},
    "memory":    {"label":"X Quellen geladen","detail":"Was geladen, max 42 Zeichen","hits":3},
    "router":    {"label":"Agenten max 22 Zeichen","detail":"Welche + warum, max 42 Zeichen","agents":["agent1","agent2"]},
    "policy":    {"label":"DSGVO ✓ · Compliance ✓","detail":"Was geprüft, max 42 Zeichen","passed":true},
    "synthesis": {"label":"Ton + Format, max 22 Zeichen","detail":"Wie formuliert, max 42 Zeichen","tone":"executive|analytical|operational|strategic"}
  },
  "answer": ["Ergebnis 1 max 60 Zeichen","Ergebnis 2 max 60 Zeichen","Call-to-Action max 60 Zeichen"]
}`;

/* ─────────────────────────────────────────
   CONNECTOR GALAXY — Use-Case-Analyse
───────────────────────────────────────── */
const ALL_CONNECTORS = [
  'SAP','Salesforce','Microsoft 365','SharePoint','Teams','Dynamics 365',
  'Power BI','Tableau','SQL','BigQuery','HubSpot','Pipedrive','Google Analytics','Jira','Confluence',
  'Slack','E-Mail','WhatsApp','Outlook','Zapier','Make','Webhook','REST API','Shopify','Stripe','n8n',
  'PDF','Excel','PowerPoint','Word','CSV','AWS S3','Google Drive','OneDrive','Notion','Airtable'
];

const GALAXY_PROMPT = `Du bist KI-OS. Analysiere den Business-Use-Case und gib JSON zurück. Gib NUR valides JSON zurück, kein Markdown.

Verfügbare Konnektoren: ${ALL_CONNECTORS.join(', ')}

Format:
{
  "title": "Kurzer Use-Case-Titel max 40 Zeichen",
  "connectors": ["Konnektor1","Konnektor2","Konnektor3"],
  "flow": "Datenfluss max 55 Zeichen z.B. SAP → KI-OS → Power BI → Teams",
  "result": "Konkretes Business-Ergebnis max 65 Zeichen",
  "category": "analytics|marketing|compliance|retail|hr|finance|strategy"
}

Regeln: connectors: 4-7 aus der Liste · flow beschreibt den Weg der Daten · result ist messbar und konkret`;

/* ─────────────────────────────────────────
   ROUTER
───────────────────────────────────────── */
async function callHaiku(system, userMsg, maxTokens) {
  const res = await axios.post('https://api.anthropic.com/v1/messages', {
    model: 'claude-haiku-4-5-20251001',
    max_tokens: maxTokens || 700,
    temperature: 0.2,
    system,
    messages: [{ role: 'user', content: String(userMsg).slice(0, 1500) }]
  }, {
    headers: { 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    timeout: 15000
  });
  let text = (res.data.content[0]?.text || '').trim()
    .replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  let parsed;
  try { parsed = JSON.parse(text); }
  catch { const m = text.match(/\{[\s\S]+\}/); if (m) parsed = JSON.parse(m[0]); else throw new Error('Kein valides JSON vom Modell.'); }
  return { parsed, usage: res.data.usage || {} };
}

async function handleSimulationsRequest(path, method, body) {
  if (path === '/simulations/kimba' && method === 'POST') {
    const raw = String(body.question || body.text || '').trim();
    if (!raw) return { statusCode: 400, body: { success: false, error: 'Keine Frage übergeben.' } };
    try {
      const { parsed, usage } = await callHaiku(KIMBA_PROMPT, raw, 700);
      return { statusCode: 200, body: { success: true, mode: 'simulation', scenario: parsed, usage } };
    } catch (e) {
      return { statusCode: 500, body: { success: false, error: e.message } };
    }
  }

  if (path === '/simulations/connectors' && method === 'POST') {
    const raw = String(body.usecase || body.text || '').trim();
    if (!raw) return { statusCode: 400, body: { success: false, error: 'Kein Use-Case übergeben.' } };
    try {
      const { parsed, usage } = await callHaiku(GALAXY_PROMPT, raw, 400);
      return { statusCode: 200, body: { success: true, mode: 'simulation', data: parsed, usage } };
    } catch (e) {
      return { statusCode: 500, body: { success: false, error: e.message } };
    }
  }

  return { statusCode: 404, body: { success: false, error: 'Route nicht gefunden.' } };
}

module.exports = { handleSimulationsRequest: enterpriseOnly(handleSimulationsRequest) };
