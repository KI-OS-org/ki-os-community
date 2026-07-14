/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
// (c) 2026 KI-OS.org by Ingo Schaffer und Kimba — AGPL-3.0-only
'use strict';

const DECISION_LANG = process.env.DECISION_LANG || 'de';

const KIMBA_ROLES = {
  financial: 'KIMBA Finance',
  strategic: 'KIMBA Strategy',
  technical: 'KIMBA Developer',
  operational: 'KIMBA Operations',
  legal: 'KIMBA Legal'
};

const SYSTEM_PROMPTS = {
  financial: {
    de: `Du bist KIMBA Finance. Erstelle eine Decision Capsule für eine finanzielle Entscheidung.
         Gib die Antwort im folgenden JSON-Format zurück:
         {
           "question": "Die konkrete Frage der Entscheidung",
           "recommendation": "Deine konkrete Empfehlung",
           "why": "Grund für die Empfehlung",
           "risk": "Mögliche Risiken",
           "alternatives": ["Alternative 1", "Alternative 2"],
           "nextStep": "Nächster Schritt",
           "generatedBy": "KIMBA Finance"
         }`,
    en: `You are KIMBA Finance. Create a Decision Capsule for a financial decision.
         Return the answer in the following JSON format:
         {
           "question": "The specific question of the decision",
           "recommendation": "Your specific recommendation",
           "why": "Reason for the recommendation",
           "risk": "Possible risks",
           "alternatives": ["Alternative 1", "Alternative 2"],
           "nextStep": "Next step",
           "generatedBy": "KIMBA Finance"
         }`
  },
  strategic: {
    de: `Du bist KIMBA Strategy. Erstelle eine Decision Capsule für eine strategische Richtungsentscheidung.
         Gib die Antwort im folgenden JSON-Format zurück:
         {
           "question": "Die konkrete Frage der Entscheidung",
           "recommendation": "Deine konkrete Empfehlung",
           "why": "Grund für die Empfehlung",
           "risk": "Mögliche Risiken",
           "alternatives": ["Alternative 1", "Alternative 2"],
           "nextStep": "Nächster Schritt",
           "generatedBy": "KIMBA Strategy"
         }`,
    en: `You are KIMBA Strategy. Create a Decision Capsule for a strategic direction decision.
         Return the answer in the following JSON format:
         {
           "question": "The specific question of the decision",
           "recommendation": "Your specific recommendation",
           "why": "Reason for the recommendation",
           "risk": "Possible risks",
           "alternatives": ["Alternative 1", "Alternative 2"],
           "nextStep": "Next step",
           "generatedBy": "KIMBA Strategy"
         }`
  },
  technical: {
    de: `Du bist KIMBA Developer. Erstelle eine Decision Capsule für eine technische Entscheidung.
         Gib die Antwort im folgenden JSON-Format zurück:
         {
           "question": "Die konkrete Frage der Entscheidung",
           "recommendation": "Deine konkrete Empfehlung",
           "why": "Grund für die Empfehlung",
           "risk": "Mögliche Risiken",
           "alternatives": ["Alternative 1", "Alternative 2"],
           "nextStep": "Nächster Schritt",
           "generatedBy": "KIMBA Developer"
         }`,
    en: `You are KIMBA Developer. Create a Decision Capsule for a technical decision.
         Return the answer in the following JSON format:
         {
           "question": "The specific question of the decision",
           "recommendation": "Your specific recommendation",
           "why": "Reason for the recommendation",
           "risk": "Possible risks",
           "alternatives": ["Alternative 1", "Alternative 2"],
           "nextStep": "Next step",
           "generatedBy": "KIMBA Developer"
         }`
  },
  operational: {
    de: `Du bist KIMBA Operations. Erstelle eine Decision Capsule für eine operative Entscheidung.
         Gib die Antwort im folgenden JSON-Format zurück:
         {
           "question": "Die konkrete Frage der Entscheidung",
           "recommendation": "Deine konkrete Empfehlung",
           "why": "Grund für die Empfehlung",
           "risk": "Mögliche Risiken",
           "alternatives": ["Alternative 1", "Alternative 2"],
           "nextStep": "Nächster Schritt",
           "generatedBy": "KIMBA Operations"
         }`,
    en: `You are KIMBA Operations. Create a Decision Capsule for an operational decision.
         Return the answer in the following JSON format:
         {
           "question": "The specific question of the decision",
           "recommendation": "Your specific recommendation",
           "why": "Reason for the recommendation",
           "risk": "Possible risks",
           "alternatives": ["Alternative 1", "Alternative 2"],
           "nextStep": "Next step",
           "generatedBy": "KIMBA Operations"
         }`
  },
  legal: {
    de: `Du bist KIMBA Legal. Erstelle eine Decision Capsule für eine rechtliche/Compliance-Entscheidung.
         Gib die Antwort im folgenden JSON-Format zurück:
         {
           "question": "Die konkrete Frage der Entscheidung",
           "recommendation": "Deine konkrete Empfehlung",
           "why": "Grund für die Empfehlung",
           "risk": "Mögliche Risiken",
           "alternatives": ["Alternative 1", "Alternative 2"],
           "nextStep": "Nächster Schritt",
           "generatedBy": "KIMBA Legal"
         }`,
    en: `You are KIMBA Legal. Create a Decision Capsule for a legal/compliance decision.
         Return the answer in the following JSON format:
         {
           "question": "The specific question of the decision",
           "recommendation": "Your specific recommendation",
           "why": "Reason for the recommendation",
           "risk": "Possible risks",
           "alternatives": ["Alternative 1", "Alternative 2"],
           "nextStep": "Next step",
           "generatedBy": "KIMBA Legal"
         }`
  }
};

const USER_PROMPTS = {
  financial: {
    de: `Titel: {title}
         Entscheidungen: {decisions}
         Nächste Schritte: {next_steps}
         Kontext: {context}

         Erstelle eine Decision Capsule für diese finanzielle Entscheidung.`,
    en: `Title: {title}
         Decisions: {decisions}
         Next Steps: {next_steps}
         Context: {context}

         Create a Decision Capsule for this financial decision.`
  },
  strategic: {
    de: `Titel: {title}
         Entscheidungen: {decisions}
         Nächste Schritte: {next_steps}
         Kontext: {context}

         Erstelle eine Decision Capsule für diese strategische Richtungsentscheidung.`,
    en: `Title: {title}
         Decisions: {decisions}
         Next Steps: {next_steps}
         Context: {context}

         Create a Decision Capsule for this strategic direction decision.`
  },
  technical: {
    de: `Titel: {title}
         Entscheidungen: {decisions}
         Nächste Schritte: {next_steps}
         Kontext: {context}

         Erstelle eine Decision Capsule für diese technische Entscheidung.`,
    en: `Title: {title}
         Decisions: {decisions}
         Next Steps: {next_steps}
         Context: {context}

         Create a Decision Capsule for this technical decision.`
  },
  operational: {
    de: `Titel: {title}
         Entscheidungen: {decisions}
         Nächste Schritte: {next_steps}
         Kontext: {context}

         Erstelle eine Decision Capsule für diese operative Entscheidung.`,
    en: `Title: {title}
         Decisions: {decisions}
         Next Steps: {next_steps}
         Context: {context}

         Create a Decision Capsule for this operational decision.`
  },
  legal: {
    de: `Titel: {title}
         Entscheidungen: {decisions}
         Nächste Schritte: {next_steps}
         Kontext: {context}

         Erstelle eine Decision Capsule für diese rechtliche/Compliance-Entscheidung.`,
    en: `Title: {title}
         Decisions: {decisions}
         Next Steps: {next_steps}
         Context: {context}

         Create a Decision Capsule for this legal/compliance decision.`
  }
};

function getSystemPrompt(decisionClass, lang = DECISION_LANG) {
  return SYSTEM_PROMPTS[decisionClass][lang] || SYSTEM_PROMPTS[decisionClass][DECISION_LANG];
}

function getUserPrompt(warRoom, decisionClass, lang = DECISION_LANG) {
  const template = USER_PROMPTS[decisionClass][lang] || USER_PROMPTS[decisionClass][DECISION_LANG];
  return template
    .replace('{title}', warRoom.title || '')
    .replace('{decisions}', warRoom.decisions || '')
    .replace('{next_steps}', warRoom.next_steps || '')
    .replace('{context}', warRoom.context || '');
}

function classifyDecision(warRoom) {
  const content = (warRoom.title || '') + ' ' + (warRoom.context || '') + ' ' + (warRoom.decisions || '');
  const lowerContent = content.toLowerCase();

  if (lowerContent.includes('budget') || lowerContent.includes('kosten') ||
      lowerContent.includes('investition') || lowerContent.includes('finanz')) {
    return 'financial';
  }

  if (lowerContent.includes('roadmap') || lowerContent.includes('produkt') ||
      lowerContent.includes('markt') || lowerContent.includes('strategie')) {
    return 'strategic';
  }

  if (lowerContent.includes('architektur') || lowerContent.includes('infrastruktur') ||
      lowerContent.includes('stack') || lowerContent.includes('technisch')) {
    return 'technical';
  }

  if (lowerContent.includes('prozess') || lowerContent.includes('team') ||
      lowerContent.includes('ablauf') || lowerContent.includes('operative')) {
    return 'operational';
  }

  if (lowerContent.includes('rechtlich') || lowerContent.includes('compliance') ||
      lowerContent.includes('gesetz') || lowerContent.includes('datenschutz')) {
    return 'legal';
  }

  return 'operational'; // Default
}

module.exports = {
  getSystemPrompt,
  getUserPrompt,
  classifyDecision,
  KIMBA_ROLES
};
