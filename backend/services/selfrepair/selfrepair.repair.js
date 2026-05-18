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
 * KI-OS SelfRepair — AI Repair Engine
 * Liest die betroffene Datei, ruft Claude/OpenAI auf und liefert:
 *   - rootCause: Erklärung des Fehlers
 *   - suggestedFix: Konkreter Code-Patch
 *   - confidence: 0.0–1.0
 *   - applyCommand: Wie der Fix angewendet werden kann
 */
'use strict';

const fs   = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '../../..');

// ---------------------------------------------------------------------------
// Provider-Auswahl (nutzt vorhandene KI-OS Provider)
// ---------------------------------------------------------------------------
async function callAI(systemPrompt, userMessage) {
  // Anthropic bevorzugt, dann OpenAI
  if (process.env.ANTHROPIC_API_KEY) {
    const { callAnthropic } = require('../providers/anthropic.provider');
    const result = await callAnthropic({
      model:      'claude-sonnet-4-6',
      system:     systemPrompt,
      messages:   [{ role: 'user', content: userMessage }],
      max_tokens: 4096,
      temperature: 0.2,  // Niedrige Temperatur für präzise Code-Fixes
    });
    return result.text;
  }
  if (process.env.OPENAI_API_KEY) {
    const { callOpenAI } = require('../providers/openai.provider');
    const result = await callOpenAI({
      model:    'gpt-4o',
      messages: [
        { role: 'system',  content: systemPrompt },
        { role: 'user',    content: userMessage },
      ],
      max_tokens: 4096,
      temperature: 0.2,
    });
    return result.text;
  }
  throw new Error('Kein AI-Provider konfiguriert (ANTHROPIC_API_KEY oder OPENAI_API_KEY benötigt)');
}

// ---------------------------------------------------------------------------
// Liest die betroffene Datei (mit Zeilenummern, max 200 Zeilen um Fehlerort)
// ---------------------------------------------------------------------------
function readAffectedFile(filePath) {
  if (!filePath) return null;
  try {
    // Absolut oder relativ zu ROOT
    const absPath = path.isAbsolute(filePath) ? filePath : path.join(ROOT, filePath);
    if (!fs.existsSync(absPath)) return null;
    const content = fs.readFileSync(absPath, 'utf8');
    const lines   = content.split('\n');
    // Erste 200 Zeilen mit Nummern
    return lines.slice(0, 200).map((l, i) => `${String(i + 1).padStart(4, ' ')} | ${l}`).join('\n');
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Parst die strukturierte AI-Antwort
// ---------------------------------------------------------------------------
function parseAIResponse(raw) {
  try {
    // Versuche JSON aus Markdown-Block zu extrahieren
    const jsonMatch = raw.match(/```json\s*([\s\S]+?)\s*```/);
    if (jsonMatch) return JSON.parse(jsonMatch[1]);
    // Direktes JSON
    if (raw.trim().startsWith('{')) return JSON.parse(raw);
  } catch {}
  // Fallback: Plaintext
  return {
    rootCause:     raw.slice(0, 500),
    suggestedFix:  null,
    confidence:    0.3,
    applyCommand:  null,
    explanation:   raw,
  };
}

// ---------------------------------------------------------------------------
// Haupt-Repair-Funktion
// ---------------------------------------------------------------------------
async function analyzeAndRepair(incident) {
  const { error, stack, source, level, affectedFile, context } = incident;

  const fileContent = readAffectedFile(affectedFile);

  const systemPrompt = `Du bist ein KI-OS Backend-Repair-Spezialist.
Deine Aufgabe: Server-Fehler analysieren und konkrete Code-Fixes vorschlagen.

Regeln:
- Antworte IMMER als valides JSON in einem \`\`\`json\`\`\`-Block
- suggestedFix ist ein vollständiger, direkt anwendbarer Code-Patch (diff oder vollständige geänderte Funktion)
- confidence: 0.0 = unsicher, 1.0 = sehr sicher
- applyCommand: Bash-Befehl zum Anwenden (optional)
- Wenn du den Fix nicht sicher kennst: confidence < 0.5 und erkläre warum

JSON-Schema:
{
  "rootCause": "Erklärung des Fehlers",
  "suggestedFix": "Code-Patch oder null",
  "confidence": 0.0-1.0,
  "applyCommand": "Befehl oder null",
  "explanation": "Ausführliche Erklärung für den Admin",
  "preventionNote": "Wie dieser Fehler in Zukunft verhindert werden kann"
}`;

  const userMessage = `## Incident Level ${level}
**Service:** ${source || 'unbekannt'}
**Fehler:** ${error}

## Stack Trace
\`\`\`
${stack ? stack.slice(0, 1500) : 'kein Stack verfügbar'}
\`\`\`

${fileContent ? `## Betroffene Datei: ${affectedFile}
\`\`\`javascript
${fileContent}
\`\`\`` : ''}

${context && Object.keys(context).length > 0 ? `## Kontext
\`\`\`json
${JSON.stringify(context, null, 2).slice(0, 500)}
\`\`\`` : ''}

Analysiere den Fehler und schlage einen konkreten Fix vor.`;

  const raw    = await callAI(systemPrompt, userMessage);
  const parsed = parseAIResponse(raw);

  return {
    rootCause:       parsed.rootCause    || 'Keine Analyse verfügbar',
    suggestedFix:    parsed.suggestedFix || null,
    confidence:      typeof parsed.confidence === 'number' ? parsed.confidence : 0.3,
    applyCommand:    parsed.applyCommand || null,
    explanation:     parsed.explanation  || parsed.rootCause || '',
    preventionNote:  parsed.preventionNote || '',
    rawResponse:     raw.slice(0, 2000),
    analyzedAt:      new Date().toISOString(),
  };
}

module.exports = { analyzeAndRepair, readAffectedFile };
