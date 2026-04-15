/**
 * KI-OS — (C) 2026 Ingo Schaffer
 * https://ki-os.org
 */
/**
 * (c) 2026 KI-OS.org — AgentMesh Simulation Controller
 * Analysiert einen Business-Case mit Claude Haiku (ressourceneffizient)
 * und gibt ein JSON-Szenario für die visuelle AgentMesh-Simulation zurück.
 */
'use strict';
const axios = require('../core/http.client');

const SYSTEM_PROMPT = `Du bist ein KI-Analyse-Agent im KI-OS AgentMesh. Analysiere den gegebenen Business-Case und gib JSON zurück, das beschreibt, welche Agenten des Systems benötigt werden und was sie tun.

Gib NUR valides JSON zurück, kein Markdown, keine Erklärungen, kein Code-Block.

Format:
{
  "task": "Kurze Aufgabe (max 52 Zeichen)",
  "supervisor_msg": ["Dispatcher-Nachricht max 28 Zeichen", "Zweite Zeile max 34 Zeichen"],
  "agents": {
    "planner":   {"active": true,  "status": "Status max 18 Zeichen"},
    "research":  {"active": true,  "status": "Status max 18 Zeichen"},
    "memory":    {"active": false, "status": "Status max 18 Zeichen"},
    "execution": {"active": true,  "status": "Status max 18 Zeichen"},
    "policy":    {"active": true,  "status": "Status max 18 Zeichen"}
  },
  "output": [
    "Ergebniszeile 1 (max 58 Zeichen)",
    "Ergebniszeile 2 (max 58 Zeichen)",
    "Ergebniszeile 3 (max 58 Zeichen)"
  ]
}

Entscheidungsregeln für Agenten:
- planner: fast immer aktiv (Aufgabenplanung)
- research: aktiv wenn externe Daten, Web, Benchmarks, Marktdaten nötig
- memory: aktiv wenn Kontext, History, Kundendaten, frühere Analysen relevant
- execution: aktiv wenn konkrete Artefakte erstellt werden (Reports, PDFs, Mails, Code)
- policy: fast immer aktiv (DSGVO, Compliance, Qualitätssicherung)
- supervisor_msg[0]: beginnt mit "Dispatch: " + Thema
- output: 3 prägnante Ergebnissätze in deutscher Sprache`;

async function handleAgentMeshRequest(path, method, body) {
  if (path === '/agentmesh/analyze' && method === 'POST') {
    const raw = String(body.case || body.text || '').trim();
    if (!raw) {
      return { statusCode: 400, body: { success: false, error: 'Kein Case-Text übergeben.' } };
    }
    const caseText = raw.slice(0, 2000);

    try {
      const res = await axios.post('https://api.anthropic.com/v1/messages', {
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 700,
        temperature: 0.2,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: caseText }]
      }, {
        headers: {
          'x-api-key': process.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json'
        },
        timeout: 15000
      });

      let text = (res.data.content[0]?.text || '').trim();
      // Strip possible markdown code fences
      text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();

      let scenario;
      try {
        scenario = JSON.parse(text);
      } catch {
        const m = text.match(/\{[\s\S]+\}/);
        if (m) scenario = JSON.parse(m[0]);
        else throw new Error('Modell hat kein valides JSON zurückgegeben.');
      }

      return {
        statusCode: 200,
        body: {
          success: true,
          mode: 'simulation',
          scenario,
          usage: res.data.usage || {}
        }
      };
    } catch (e) {
      const msg = e.response?.data?.error?.message || e.message || 'Unbekannter Fehler';
      return { statusCode: 500, body: { success: false, error: msg } };
    }
  }

  return { statusCode: 404, body: { success: false, error: 'Route nicht gefunden.' } };
}

module.exports = { handleAgentMeshRequest };
