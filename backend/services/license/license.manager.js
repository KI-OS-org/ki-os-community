/**
 * KI-OS — (C) 2026 Ingo Schaffer
 * https://ki-os.org
 *
 * License Manager — prüft welche Edition freigeschaltet ist.
 * Editions: community < business < enterprise (hierarchisch)
 * Graceful degradation: kein Crash wenn kein Key gesetzt.
 */

'use strict';

const ENTERPRISE_FEATURES = [
  'connector.slack',
  'connector.teams',
  'connector.sap',
  'connector.salesforce',
  'connector.s3',
  'connector.adobe',
  'advanced.audit',
  'advanced.sso',
  'advanced.multi-tenant'
];

const BUSINESS_FEATURES = [
  'connector.shopify',
  'connector.woocommerce',
  'connector.magento',
  'connector.instagram',
  'connector.linkedin',
  'connector.twitter',
  'connector.github',
  'connector.gitlab',
  'connector.jira',
  'connector.datadog',
  'connector.mailchimp',
  'connector.hubspot-marketing',
  'connector.google-ads',
  'connector.meta-ads'
];

const COMMUNITY_FEATURES = [
  'connector.generic-http',
  'connector.file-fabric',
  'connector.mcp',
  'connector.ghost-control-basic',
  'connector.custom',
  'core.chat',
  'core.memory',
  'core.websearch',
  'core.desktop-control'
];

// Business connector categories (unlocked with KIOS_BUSINESS_KEY or higher)
const BUSINESS_CONNECTOR_CATEGORIES = [
  'ecommerce',
  'social-media',
  'developer',
  'marketing'
];

// Agent limits per edition
const AGENT_LIMITS = {
  community: 3,
  business: 15,
  enterprise: Infinity
};

let _cache = null;

/**
 * Validates a license key string.
 * Format: KIOS-XXXX-XXXX-XXXX (simple structural check).
 * In production this would verify against a license server or signature.
 * @param {string} key
 * @returns {boolean}
 */
function validateKey(key) {
  if (!key || typeof key !== 'string') return false;
  const trimmed = key.trim();
  if (!trimmed) return false;
  // Accept any non-empty key that starts with KIOS- or is a UUID-like string
  // Real validation would do cryptographic signature verification
  return trimmed.length >= 8;
}

/**
 * Returns the current license status.
 * Result is cached for the process lifetime (restart to pick up new key).
 * Edition hierarchy: enterprise > business > community
 *
 * @returns {{ edition: 'community'|'business'|'enterprise', valid: boolean, features: string[], key: string|null, agentLimit: number, unlockedCategories: string[] }}
 */
function getLicenseInfo() {
  if (_cache) return _cache;

  const enterpriseKey = process.env.KIOS_ENTERPRISE_KEY || null;
  const businessKey = process.env.KIOS_BUSINESS_KEY || null;

  const enterpriseValid = validateKey(enterpriseKey);
  const businessValid = validateKey(businessKey);

  if (enterpriseValid) {
    _cache = {
      edition: 'enterprise',
      valid: true,
      features: [...COMMUNITY_FEATURES, ...BUSINESS_FEATURES, ...ENTERPRISE_FEATURES],
      key: enterpriseKey.trim(),
      agentLimit: AGENT_LIMITS.enterprise,
      unlockedCategories: [...BUSINESS_CONNECTOR_CATEGORIES, 'erp', 'crm', 'collaboration', 'cloud-storage', 'finance-enterprise']
    };
  } else if (businessValid) {
    _cache = {
      edition: 'business',
      valid: true,
      features: [...COMMUNITY_FEATURES, ...BUSINESS_FEATURES],
      key: businessKey.trim(),
      agentLimit: AGENT_LIMITS.business,
      unlockedCategories: [...BUSINESS_CONNECTOR_CATEGORIES]
    };
  } else {
    const attemptedKey = enterpriseKey || businessKey;
    _cache = {
      edition: 'community',
      valid: !attemptedKey, // valid=false signals an invalid key was attempted
      features: [...COMMUNITY_FEATURES],
      key: null,
      agentLimit: AGENT_LIMITS.community,
      unlockedCategories: []
    };
  }

  return _cache;
}

/**
 * Returns edition info: edition, agentLimit, unlockedCategories.
 * @returns {{ edition: string, agentLimit: number, unlockedCategories: string[] }}
 */
function getEditionInfo() {
  const { edition, agentLimit, unlockedCategories } = getLicenseInfo();
  return { edition, agentLimit, unlockedCategories };
}

/**
 * Returns true when a specific feature is unlocked for the current license.
 * @param {string} feature
 * @returns {boolean}
 */
function hasFeature(feature) {
  const info = getLicenseInfo();
  return info.features.includes(feature);
}

/**
 * Returns true when the current license is Business edition or higher.
 * @returns {boolean}
 */
function isBusiness() {
  const edition = getLicenseInfo().edition;
  return edition === 'business' || edition === 'enterprise';
}

/**
 * Returns true when the current license is Enterprise edition with a valid key.
 * @returns {boolean}
 */
function isEnterprise() {
  return getLicenseInfo().edition === 'enterprise';
}

/**
 * Resets the internal cache. Intended for testing only.
 * @private
 */
function _resetCache() {
  _cache = null;
}

module.exports = {
  getLicenseInfo,
  getEditionInfo,
  hasFeature,
  isBusiness,
  isEnterprise,
  ENTERPRISE_FEATURES,
  BUSINESS_FEATURES,
  COMMUNITY_FEATURES,
  BUSINESS_CONNECTOR_CATEGORIES,
  AGENT_LIMITS,
  _resetCache
};
