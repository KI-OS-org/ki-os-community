/**
 * KI-OS — (C) 2026 Ingo Schaffer
 * https://ki-os.org
 */
/**
 * KI-OS — Efficiency Agent Reporter
 * Ruft LLM auf um aus Crawler + Analyzer-Daten einen
 * strukturierten Verbesserungs-Report zu erstellen.
 */
'use strict';

const logger = require('../core/logger.service');

const SYSTEM_PROMPT = `Du bist der KI-OS Product Intelligence Agent.
Deine Aufgabe ist es, auf Basis von:
1. Aktuellen Wettbewerber-Informationen (Web-Recherche)
2. Internem KI-OS Analyse-Bericht (Versions, Features, Dependencies)

einen strukturierten, priorisierten Verbesserungs-Report für den KI-OS Administrator zu erstellen.

Antworte AUSSCHLIESSLICH mit validem JSON in diesem Format:
{
  "executiveSummary": "2-3 Sätze Zusammenfassung der wichtigsten Erkenntnisse",
  "competitorHighlights": [
    { "competitor": "Name", "feature": "Was Neu ist", "relevance": "Warum relevant für KI-OS", "source": "URL oder Quelle" }
  ],
  "featureSuggestions": [
    {
      "title": "Feature-Titel",
      "description": "Was gebaut werden soll",
      "priority": "HIGH|MEDIUM|LOW",
      "effort": "Tage: 1-5|Wochen: 1-2|Wochen: 3-6",
      "category": "feature|security|performance|ux|integration",
      "rationale": "Warum jetzt wichtig",
      "inspired_by": "Wettbewerber oder Trend (optional)"
    }
  ],
  "updateRecommendations": [
    { "package": "Name", "current": "Version", "latest": "Version", "urgency": "critical|recommended|optional", "reason": "Warum updaten" }
  ],
  "quickWins": [
    { "title": "Titel", "description": "Was zu tun ist", "effort": "Stunden: 2-4|Stunden: 4-8|Tage: 1-2", "impact": "HIGH|MEDIUM" }
  ],
  "technicalDebt": [
    { "area": "Bereich", "description": "Problem", "risk": "high|medium|low" }
  ],
  "trendInsights": "Paragraph über aktuelle KI/Automatisierungs-Trends und was das für KI-OS bedeutet"
}

Maximal: 5 Competitor Highlights, 8 Feature Suggestions, 5 Quick Wins, 4 Tech Debt Items.
Priorisiere nach Business-Impact und Implementierungsaufwand.
Antworte auf Deutsch.`;

/**
 * Ruft den LLM-Provider auf für den Report
 */
async function callLLM(userPrompt) {
  // Priorisierung: Anthropic → OpenAI → Gemini
  const providers = ['anthropic', 'openai', 'gemini'];

  for (const providerName of providers) {
    try {
      if (providerName === 'anthropic' && process.env.ANTHROPIC_API_KEY) {
        const { callAnthropic } = require('../providers/anthropic.provider');
        const response = await callAnthropic({
          model:       process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6',
          system:      SYSTEM_PROMPT,
          messages:    [{ role: 'user', content: userPrompt }],
          max_tokens:  4000,
        });
        return extractJSON(response);
      }

      if (providerName === 'openai' && process.env.OPENAI_API_KEY) {
        const { callOpenAI } = require('../providers/openai.provider');
        const response = await callOpenAI({
          model:       process.env.OPENAI_MODEL || 'gpt-4o',
          system:      SYSTEM_PROMPT,
          messages:    [{ role: 'user', content: userPrompt }],
          max_tokens:  4000,
        });
        return extractJSON(response);
      }

      if (providerName === 'gemini' && process.env.GEMINI_API_KEY) {
        const { callGemini } = require('../providers/gemini.provider');
        const response = await callGemini({
          model:    process.env.GEMINI_MODEL || 'gemini-2.0-flash',
          system:   SYSTEM_PROMPT,
          messages: [{ role: 'user', content: userPrompt }],
        });
        return extractJSON(response);
      }
    } catch (e) {
      logger.warn('efficiency.reporter.llm_failed', { provider: providerName, message: e.message });
    }
  }

  throw new Error('Kein LLM-Provider verfügbar für Efficiency-Report');
}

function extractJSON(text) {
  if (typeof text !== 'string') {
    if (text?.content) text = text.content;
    else text = JSON.stringify(text);
  }
  // JSON aus Markdown Code-Block extrahieren falls vorhanden
  const codeBlock = text.match(/```(?:json)?\s*([\s\S]+?)\s*```/);
  const jsonStr = codeBlock ? codeBlock[1] : text;
  return JSON.parse(jsonStr.trim());
}

/**
 * Baut den User-Prompt aus Crawler + Analyzer Daten
 */
function buildPrompt(crawlerData, analyzerData) {
  const { competitor, tech } = crawlerData;
  const { version, dependencies, features, integrations } = analyzerData;

  const competitorSection = competitor.length > 0
    ? competitor.slice(0, 10).map(r =>
        `- [${r.query}] ${r.title}: ${r.snippet} (${r.url})`
      ).join('\n')
    : 'Keine Wettbewerber-Daten verfügbar (Websearch nicht konfiguriert)';

  const techSection = tech.length > 0
    ? tech.slice(0, 6).map(r =>
        `- ${r.title}: ${r.snippet}`
      ).join('\n')
    : 'Keine Tech-Updates gefunden';

  const outdatedPackages = dependencies.packages
    .filter(p => p.severity === 'major' || p.severity === 'minor')
    .slice(0, 8)
    .map(p => `- ${p.name}: ${p.current} → ${p.latest} (${p.severity})`)
    .join('\n') || 'Alle wichtigen Pakete aktuell';

  const missingIntegrations = integrations.missing
    .filter(k => k.includes('API_KEY') || k.includes('TOKEN') || k.includes('SECRET'))
    .slice(0, 10)
    .join(', ') || 'keine';

  return `
=== KI-OS SYSTEM-ANALYSE ===
Version: ${version}
Aktuelle Features (aus Docs): ${features.docFeatures.slice(0, 10).join(', ')}
Aktive Services: ${features.services.join(', ')}
Konfigurierte Integrationen: ${integrations.configured.slice(0, 10).join(', ')}
Nicht konfigurierte API-Keys: ${missingIntegrations}

=== DEPENDENCY-STATUS ===
Veraltete Pakete (major/minor):
${outdatedPackages}

=== WETTBEWERBER-NEWS (Web-Recherche) ===
${competitorSection}

=== TECH-UPDATES ===
${techSection}

=== AUFGABE ===
Erstelle einen vollständigen Efficiency & Competitive Intelligence Report für den Admin.
Berücksichtige den aktuellen Stand von KI-OS, identifiziere Lücken gegenüber Wettbewerbern,
und priorisiere Verbesserungsvorschläge nach Business-Impact.
`.trim();
}

/**
 * Hauptfunktion: Generiert den vollständigen Report
 */
async function generateReport(crawlerData, analyzerData) {
  const prompt = buildPrompt(crawlerData, analyzerData);
  logger.info('efficiency.reporter.generate_start', {});
  const report = await callLLM(prompt);
  return report;
}

module.exports = { generateReport };
