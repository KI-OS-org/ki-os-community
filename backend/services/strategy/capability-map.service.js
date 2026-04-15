/**
 * Capability Map Service
 * 
 * Strategische Übersicht aller KI-OS Fähigkeiten.
 * Zeigt was das System kann, Governance-Level, und Lücken.
 * 
 * @module services/strategy/capability-map.service
 */

const capabilityRegistry = require('../connectors/capability.registry');
const agentRegistry = require('../agent/agent.registry.service');

/**
 * Capability Kategorien
 */
const CAPABILITY_CATEGORIES = {
  AI_AND_AUTOMATION: 'AI & Automation',
  DATA_AND_MEMORY: 'Data & Memory',
  INTEGRATION: 'Integration',
  GOVERNANCE: 'Governance',
  DESKTOP_CONTROL: 'Desktop Control',
  FILES: 'Files',
  RESEARCH: 'Research',
};

/**
 * Governance Level
 */
const GOVERNANCE_LEVELS = {
  NONE: { level: 0, name: 'None', color: 'gray', description: 'Keine Governance' },
  BASIC: { level: 1, name: 'Basic', color: 'blue', description: 'Basis-Prüfung' },
  STANDARD: { level: 2, name: 'Standard', color: 'yellow', description: 'Standard-Governance' },
  HIGH: { level: 3, name: 'High', color: 'orange', description: 'Hohe Governance' },
  CRITICAL: { level: 4, name: 'Critical', color: 'red', description: 'Kritisch, Approval required' },
};

/**
 * Holt alle aktiven Capabilities aus der Registry
 */
function getAllCapabilities() {
  const registry = capabilityRegistry.getCapabilityRegistryPayload();
  
  return registry.connectors?.map(connector => ({
    id: connector.id,
    name: connector.name,
    category: mapCategory(connector.metadata?.category || connector.protocol),
    capabilities: connector.capabilities || [],
    governanceLevel: mapGovernanceLevel(connector.trustLevel),
    health: connector.health || 'unknown',
    protocol: connector.protocol,
    trustLevel: connector.trustLevel,
    active: connector.active !== false,
    metadata: connector.metadata || {},
  })) || [];
}

/**
 * Holt Agenten-Capabilities
 */
function getAgentCapabilities() {
  try {
    const agents = agentRegistry.list();
    return agents.map(agent => ({
      id: agent.id,
      name: agent.name,
      category: CAPABILITY_CATEGORIES.AI_AND_AUTOMATION,
      capabilities: [agent.category || 'agent'],
      governanceLevel: GOVERNANCE_LEVELS.STANDARD,
      health: agent.status === 'active' ? 'healthy' : 'degraded',
      active: agent.status === 'active',
      metadata: {
        category: agent.category,
        prompt: agent.prompt?.substring(0, 100) + '...',
      },
    }));
  } catch (e) {
    return [];
  }
}

/**
 * Erstellt die Capability Map mit Gap-Analyse
 */
function getCapabilityMap() {
  const connectorCapabilities = getAllCapabilities();
  const agentCapabilities = getAgentCapabilities();
  
  const allCapabilities = [...connectorCapabilities, ...agentCapabilities];
  
  // Gruppieren nach Kategorie
  const byCategory = {};
  for (const cap of allCapabilities) {
    if (!byCategory[cap.category]) {
      byCategory[cap.category] = [];
    }
    byCategory[cap.category].push(cap);
  }
  
  // Gap-Analyse
  const gaps = identifyGaps(allCapabilities);
  
  // Statistiken
  const stats = {
    total: allCapabilities.length,
    active: allCapabilities.filter(c => c.active).length,
    healthy: allCapabilities.filter(c => c.health === 'healthy').length,
    byGovernanceLevel: {
      none: allCapabilities.filter(c => c.governanceLevel.level === 0).length,
      basic: allCapabilities.filter(c => c.governanceLevel.level === 1).length,
      standard: allCapabilities.filter(c => c.governanceLevel.level === 2).length,
      high: allCapabilities.filter(c => c.governanceLevel.level === 3).length,
      critical: allCapabilities.filter(c => c.governanceLevel.level === 4).length,
    },
    byCategory: Object.keys(byCategory).reduce((acc, key) => {
      acc[key] = byCategory[key].length;
      return acc;
    }, {}),
  };
  
  return {
    capabilities: allCapabilities,
    byCategory,
    gaps,
    stats,
    governanceLevels: GOVERNANCE_LEVELS,
  };
}

/**
 * Identifiziert Lücken in der Capability-Abdeckung
 */
function identifyGaps(capabilities) {
  const gaps = [];
  
  // Erwartete Capabilities definieren
  const expectedCapabilities = [
    { id: 'web-search', name: 'Web Search', category: CAPABILITY_CATEGORIES.RESEARCH },
    { id: 'memory-search', name: 'Memory Search', category: CAPABILITY_CATEGORIES.DATA_AND_MEMORY },
    { id: 'file-handling', name: 'File Handling', category: CAPABILITY_CATEGORIES.FILES },
    { id: 'api-integration', name: 'API Integration', category: CAPABILITY_CATEGORIES.INTEGRATION },
    { id: 'governance-check', name: 'Governance Check', category: CAPABILITY_CATEGORIES.GOVERNANCE },
  ];
  
  // Prüfen welche fehlen
  for (const expected of expectedCapabilities) {
    const found = capabilities.some(cap => 
      cap.capabilities?.some(c => c.toLowerCase().includes(expected.id.split('-')[0])) ||
      cap.name.toLowerCase().includes(expected.id.split('-')[0])
    );
    
    if (!found) {
      gaps.push({
        capability: expected,
        severity: 'high',
        description: `Capability "${expected.name}" fehlt in ${expected.category}`,
        recommendation: `Connector oder Integration für "${expected.name}" hinzufügen`,
      });
    }
  }
  
  // Health-basierte Gaps
  const unhealthy = capabilities.filter(c => c.health !== 'healthy');
  for (const cap of unhealthy) {
    gaps.push({
      capability: { id: cap.id, name: cap.name, category: cap.category },
      severity: cap.health === 'degraded' ? 'medium' : 'high',
      description: `Capability "${cap.name}" ist nicht gesund (${cap.health})`,
      recommendation: `Health-Check durchführen und Issue beheben`,
    });
  }
  
  return gaps;
}

/**
 * Mapping von Category-String zu Enum
 */
function mapCategory(category) {
  const mapping = {
    'desktop': CAPABILITY_CATEGORIES.DESKTOP_CONTROL,
    'automation': CAPABILITY_CATEGORIES.AI_AND_AUTOMATION,
    'memory': CAPABILITY_CATEGORIES.DATA_AND_MEMORY,
    'research': CAPABILITY_CATEGORIES.RESEARCH,
    'files': CAPABILITY_CATEGORIES.FILES,
    'connectors': CAPABILITY_CATEGORIES.INTEGRATION,
    'integration': CAPABILITY_CATEGORIES.INTEGRATION,
    'governance': CAPABILITY_CATEGORIES.GOVERNANCE,
  };
  return mapping[category] || CAPABILITY_CATEGORIES.INTEGRATION;
}

/**
 * Mapping von Trust-Level zu Governance-Level
 */
function mapGovernanceLevel(trustLevel) {
  const mapping = {
    'none': GOVERNANCE_LEVELS.NONE,
    'low': GOVERNANCE_LEVELS.BASIC,
    'standard': GOVERNANCE_LEVELS.STANDARD,
    'high': GOVERNANCE_LEVELS.HIGH,
    'restricted': GOVERNANCE_LEVELS.CRITICAL,
  };
  return mapping[trustLevel] || GOVERNANCE_LEVELS.STANDARD;
}

/**
 * Holt Investment-Empfehlungen basierend auf Gaps
 */
function getInvestmentRecommendations() {
  const map = getCapabilityMap();
  const recommendations = [];
  
  // Gap-basierte Empfehlungen
  for (const gap of map.gaps) {
    recommendations.push({
      type: 'gap-closure',
      priority: gap.severity === 'high' ? 'high' : 'medium',
      capability: gap.capability.name,
      category: gap.capability.category,
      description: gap.description,
      recommendation: gap.recommendation,
      estimatedEffort: 'medium',
      estimatedCost: '€5.000-15.000',
    });
  }
  
  // Health-basierte Empfehlungen
  const unhealthyCount = map.capabilities.filter(c => c.health !== 'healthy').length;
  if (unhealthyCount > 0) {
    recommendations.push({
      type: 'health-improvement',
      priority: unhealthyCount > 2 ? 'high' : 'medium',
      capability: 'System Health',
      category: 'Infrastructure',
      description: `${unhealthyCount} Capabilities sind nicht gesund`,
      recommendation: 'Health-Checks durchführen und Issues beheben',
      estimatedEffort: 'low',
      estimatedCost: '€1.000-5.000',
    });
  }
  
  // Governance-basierte Empfehlungen
  const lowGovernanceCount = map.stats.byGovernanceLevel.none + map.stats.byGovernanceLevel.basic;
  if (lowGovernanceCount > 0) {
    recommendations.push({
      type: 'governance-enhancement',
      priority: 'medium',
      capability: 'Governance Coverage',
      category: 'Governance',
      description: `${lowGovernanceCount} Capabilities haben niedrige Governance-Level`,
      recommendation: 'Governance-Level für kritische Capabilities erhöhen',
      estimatedEffort: 'medium',
      estimatedCost: '€3.000-10.000',
    });
  }
  
  return recommendations;
}

module.exports = {
  getCapabilityMap,
  getAllCapabilities,
  getAgentCapabilities,
  getInvestmentRecommendations,
  GOVERNANCE_LEVELS,
  CAPABILITY_CATEGORIES,
};
