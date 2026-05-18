/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
/**
 * Ghost Control — Ghost Planner Service
 * 
 * Generiert GhostPlans basierend auf User-Input.
 * Analysiert Intent und erstellt Step-Sequenz.
 * 
 * @module services/ghost/ghost-planner.service.js
 * (c) 2026 KI-OS.org by Ingo Schaffer und Kimba
 * @license AGPL-3.0-only
 */

const uuid = require('uuid');

/**
 * Intent-Typen für Ghost Control
 */
const INTENT_TYPES = {
  CREATE_AGENT: 'create_agent',
  CREATE_JOB: 'create_job',
  CREATE_FLOW: 'create_flow',
  NAVIGATE: 'navigate',
  SEARCH: 'search',
  UNKNOWN: 'unknown',
};

/**
 * Ghost Planner Service
 */
class GhostPlannerService {
  /**
   * Analysiert User-Input und erstellt GhostPlan
   * 
   * @param {string} goal - User-Ziel (z.B. "Erstelle einen Agenten")
   * @param {string} mode - 'demo' oder 'build'
   * @returns {Promise<GhostPlan>}
   */
  async generatePlan(goal, mode = 'demo') {
    const intent = this.classifyIntent(goal);
    
    let steps = [];
    
    switch (intent.type) {
      case INTENT_TYPES.CREATE_AGENT:
        steps = await this.generateAgentSteps(intent.data, mode);
        break;
      case INTENT_TYPES.CREATE_JOB:
        steps = await this.generateJobSteps(intent.data, mode);
        break;
      case INTENT_TYPES.CREATE_FLOW:
        steps = await this.generateFlowSteps(intent.data, mode);
        break;
      case INTENT_TYPES.NAVIGATE:
        steps = await this.generateNavigateSteps(intent.data, mode);
        break;
      default:
        steps = await this.generateUnknownSteps(goal, mode);
    }
    
    return {
      id: uuid.v4(),
      mode,
      title: this.generateTitle(intent),
      description: goal,
      steps,
      createdAt: new Date().toISOString(),
      sessionId: uuid.v4(),
    };
  }

  /**
   * Klassifiziert den Intent aus dem User-Input
   */
  classifyIntent(goal) {
    const lowerGoal = goal.toLowerCase();
    
    // Agent erstellen
    if (lowerGoal.includes('agent') && (lowerGoal.includes('erstelle') || lowerGoal.includes('legen') || lowerGoal.includes('create'))) {
      return {
        type: INTENT_TYPES.CREATE_AGENT,
        data: this.extractAgentData(goal),
        confidence: 0.9,
      };
    }
    
    // Job erstellen
    if (lowerGoal.includes('job') && (lowerGoal.includes('plan') || lowerGoal.includes('schedule') || lowerGoal.includes('create'))) {
      return {
        type: INTENT_TYPES.CREATE_JOB,
        data: this.extractJobData(goal),
        confidence: 0.85,
      };
    }
    
    // Flow erstellen
    if (lowerGoal.includes('flow') || lowerGoal.includes('workflow') || lowerGoal.includes('dag')) {
      return {
        type: INTENT_TYPES.CREATE_FLOW,
        data: this.extractFlowData(goal),
        confidence: 0.85,
      };
    }
    
    // Navigation
    if (lowerGoal.includes('zeig') || lowerGoal.includes('geh zu') || lowerGoal.includes('open')) {
      return {
        type: INTENT_TYPES.NAVIGATE,
        data: this.extractNavigationData(goal),
        confidence: 0.8,
      };
    }
    
    // Unknown
    return {
      type: INTENT_TYPES.UNKNOWN,
      data: { goal },
      confidence: 0.5,
    };
  }

  /**
   * Extrahiert Agent-Daten aus Input
   */
  extractAgentData(goal) {
    // Einfache Extraktion (kann mit NLP verbessert werden)
    // Match: "Marketing-Agent", 'Marketing-Agent', oder Marketing-Agent
    const nameMatch = goal.match(/(?:namens?|called?|name:?|erstellen.*?["']?)(["']?)([^"']+)["']?/i);
    const categoryMatch = goal.match(/(?:für|category|type:?|als.*?)\s*(["']?)([^"']+)["']?/i);

    return {
      name: nameMatch && nameMatch[2] && nameMatch[2].trim().length > 0 
        ? nameMatch[2].trim() 
        : 'Neuer Agent',
      category: categoryMatch && categoryMatch[2] 
        ? categoryMatch[2].trim() 
        : 'General',
      prompt: goal,
    };
  }

  /**
   * Generiert Steps für Agent-Erstellung
   */
  async generateAgentSteps(data, mode) {
    const isBuild = mode === 'build';
    
    return [
      {
        id: uuid.v4(),
        type: 'speak',
        callout: isBuild 
          ? `Alles klar — ich lege deinen "${data.name}" Agenten direkt an. Du kannst jederzeit übernehmen.`
          : `Ich zeige dir wie man einen Agenten namens "${data.name}" erstellt.`,
        duration: 3000,
      },
      {
        id: uuid.v4(),
        type: 'navigate',
        target: '/agents',
        callout: 'Ich navigiere zur Agenten-Übersicht.',
        duration: 800,
      },
      {
        id: uuid.v4(),
        type: 'spotlight',
        target: '[data-ghost="new-agent-btn"]',
        callout: 'Hier erstelle ich einen neuen Agenten.',
        duration: 1200,
      },
      {
        id: uuid.v4(),
        type: 'click',
        target: '[data-ghost="new-agent-btn"]',
        callout: 'Ich öffne das Formular.',
        duration: 600,
      },
      {
        id: uuid.v4(),
        type: 'fill',
        target: '[data-ghost="agent-name"]',
        value: data.name,
        callout: `Ich vergebe den Namen: ${data.name}`,
        duration: 1500,
      },
      {
        id: uuid.v4(),
        type: 'fill',
        target: '[data-ghost="agent-category"]',
        value: data.category,
        callout: `Kategorie: ${data.category}`,
        duration: 800,
      },
      {
        id: uuid.v4(),
        type: 'fill',
        target: '[data-ghost="agent-prompt"]',
        value: data.prompt,
        callout: 'Ich formuliere den System-Prompt.',
        duration: 2200,
      },
      ...(isBuild ? [
        {
          id: uuid.v4(),
          type: 'confirm',
          callout: 'Soll ich den Agenten jetzt speichern?',
          duration: 0,
          requiresConfirmation: true,
        },
        {
          id: uuid.v4(),
          type: 'api_call',
          target: '/api/agents',
          payload: {
            name: data.name,
            category: data.category,
            prompt: data.prompt,
          },
          callout: 'Ich speichere den Agenten.',
          duration: 1000,
        },
      ] : []),
      {
        id: uuid.v4(),
        type: 'speak',
        callout: isBuild
          ? 'Fertig! Dein Agent ist live. Du findest ihn in der Agenten-Übersicht.'
          : 'Und so einfach geht das! Du kannst jetzt selbst weitermachen oder mich nochmal fragen.',
        duration: 3000,
      },
    ];
  }

  /**
   * Generiert Steps für Job-Erstellung
   */
  async generateJobSteps(data, mode) {
    const isBuild = mode === 'build';
    
    return [
      {
        id: uuid.v4(),
        type: 'speak',
        callout: isBuild
          ? 'Ich erstelle einen neuen Job für dich.'
          : 'Ich zeige dir wie man einen Job erstellt.',
        duration: 2500,
      },
      {
        id: uuid.v4(),
        type: 'navigate',
        target: '/jobs',
        callout: 'Ich navigiere zur Job-Übersicht.',
        duration: 800,
      },
      // ... weitere Steps für Job-Erstellung
    ];
  }

  /**
   * Generiert Steps für Flow-Erstellung
   */
  async generateFlowSteps(data, mode) {
    const isBuild = mode === 'build';
    
    return [
      {
        id: uuid.v4(),
        type: 'speak',
        callout: isBuild
          ? 'Ich erstelle einen neuen Flow für dich.'
          : 'Ich zeige dir wie man einen Flow erstellt.',
        duration: 2500,
      },
      {
        id: uuid.v4(),
        type: 'navigate',
        target: '/flows/studio',
        callout: 'Ich navigiere zum Flow Studio.',
        duration: 800,
      },
      // ... weitere Steps für Flow-Erstellung
    ];
  }

  /**
   * Generiert Steps für Navigation
   */
  async generateNavigateSteps(data, mode) {
    return [
      {
        id: uuid.v4(),
        type: 'speak',
        callout: `Ich navigiere zu ${data.destination || 'dem Ziel'}.`,
        duration: 2000,
      },
      {
        id: uuid.v4(),
        type: 'navigate',
        target: data.route || '/',
        callout: `Unterwegs zu ${data.destination || 'dem Ziel'}...`,
        duration: 800,
      },
    ];
  }

  /**
   * Generiert Steps für unbekannte Intents
   */
  async generateUnknownSteps(goal, mode) {
    return [
      {
        id: uuid.v4(),
        type: 'speak',
        callout: 'Ich habe deine Anfrage verstanden. Lass mich dir zeigen wie das geht.',
        duration: 2500,
      },
      {
        id: uuid.v4(),
        type: 'navigate',
        target: '/workspace',
        callout: 'Ich öffne den Workspace.',
        duration: 800,
      },
    ];
  }

  /**
   * Generiert Titel für Plan
   */
  generateTitle(intent) {
    switch (intent.type) {
      case INTENT_TYPES.CREATE_AGENT:
        return `Agent "${intent.data.name}" erstellen`;
      case INTENT_TYPES.CREATE_JOB:
        return 'Job erstellen';
      case INTENT_TYPES.CREATE_FLOW:
        return 'Flow erstellen';
      case INTENT_TYPES.NAVIGATE:
        return `Navigiere zu ${intent.data.destination || 'Ziel'}`;
      default:
        return 'Ghost Control';
    }
  }

  /**
   * Extrahiert Job-Daten aus Input
   */
  extractJobData(goal) {
    return {
      name: 'Neuer Job',
      schedule: 'daily',
      ...this.extractAgentData(goal), // Wiederverwendung
    };
  }

  /**
   * Extrahiert Flow-Daten aus Input
   */
  extractFlowData(goal) {
    return {
      name: 'Neuer Flow',
      type: 'dag',
    };
  }

  /**
   * Extrahiert Navigation-Daten aus Input
   */
  extractNavigationData(goal) {
    const lowerGoal = goal.toLowerCase();
    
    if (lowerGoal.includes('agent')) {
      return { route: '/agents', destination: 'Agenten' };
    }
    if (lowerGoal.includes('job')) {
      return { route: '/jobs', destination: 'Jobs' };
    }
    if (lowerGoal.includes('flow') || lowerGoal.includes('studio')) {
      return { route: '/flows/studio', destination: 'Flow Studio' };
    }
    
    return { route: '/', destination: 'Startseite' };
  }
}

module.exports = GhostPlannerService;
