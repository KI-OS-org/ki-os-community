/**
 * KI-OS — (C) 2026 Ingo Schaffer
 * https://ki-os.org
 */
'use strict';
const fs = require('fs');
const path = require('path');
const Observability = require('../core/observability.service');
const { writeAudit } = require('../ui/ui.audit');

const POLICY_VERSION = 'v3';
const DEFAULT_POLICY_DEFINITIONS = Object.freeze([
  {
    id: 'desktop-read-basic', tools: ['desktop_status', 'desktop_observe', 'desktop_screenshot'], allowRoles: ['admin', 'operator', 'viewer', 'auditor', 'user'], effect: 'allow', description: 'Read-only desktop visibility actions are broadly allowed for authenticated roles.'
  },
  {
    id: 'desktop-safe-actions', tools: ['desktop_action'], actions: ['click', 'wait', 'scroll', 'move'], allowRoles: ['admin', 'operator'], effect: 'allow', description: 'Low-risk desktop actions are allowed for admin and operator.'
  },
  {
    id: 'desktop-critical-approval', tools: ['desktop_action', 'desktop_stop', 'desktop_session_lock', 'desktop_session_unlock'], actions: ['type', 'hotkey', 'drag', 'open', 'command', 'script', 'lock', 'unlock', 'stop'], allowRoles: ['admin'], escalateRoles: ['operator'], effect: 'mixed', description: 'Critical desktop actions require admin or operator approval.'
  },
  {
    id: 'webhook-trigger-critical', tools: ['webhook_trigger'], allowRoles: ['admin'], escalateRoles: ['operator'], effect: 'mixed', description: 'Webhook trigger is treated as a critical external action.'
  },
  {
    id: 'mcp-invoke-governed', tools: ['mcp_invoke'], allowRoles: ['admin'], escalateRoles: ['operator'], effect: 'mixed', description: 'MCP connector invocation is standardized and governed like other external actions.'
  },
  {
    id: 'provider-call-governed', tools: ['provider_call', 'llm_invoke'], allowRoles: ['admin', 'operator'], escalateRoles: ['auditor'], effect: 'mixed', description: 'LLM and provider calls are governance-aware by default.'
  }
]);

function policyConfigPath() {
  return process.env.GOVERNANCE_POLICY_CONFIG || path.join(process.cwd(), 'backend', 'config', 'governance.policies.json');
}

function normalizeRole(ctx = {}) { return String(ctx?.pki?.role || ctx?.role || 'guest').toLowerCase(); }
function toToolKey(tool = '') { return String(tool || '').toLowerCase(); }
function toActionKey(action = '') { return String(action || '').toLowerCase(); }

let cachedPolicies = null;
let cachedPoliciesMtime = 0;
function loadConfiguredPolicies() {
  const cfgPath = policyConfigPath();
  try {
    const stat = fs.statSync(cfgPath);
    const mtime = Number(stat.mtimeMs || 0);
    if (cachedPolicies && cachedPoliciesMtime === mtime) return cachedPolicies;
    const parsed = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
    if (Array.isArray(parsed?.policies) && parsed.policies.length) {
      cachedPolicies = parsed.policies;
      cachedPoliciesMtime = mtime;
      return cachedPolicies;
    }
  } catch {}
  cachedPolicies = DEFAULT_POLICY_DEFINITIONS;
  cachedPoliciesMtime = 0;
  return DEFAULT_POLICY_DEFINITIONS;
}


function normalizeStringArray(items = []) {
  return Array.isArray(items) ? items.map((item) => String(item || '').toLowerCase()).filter(Boolean) : [];
}

function normalizeModelId(value = '') {
  const model = String(value || '').trim().toLowerCase();
  if (!model) return '';
  const aliases = {
    'claude-sonnet-4.6': 'claude-sonnet-4-6',
    'claude-opus-4.6': 'claude-opus-4-6',
    'claude-haiku-4.5': 'claude-haiku-4-5-20251001',
    'gemini-2.5-pro': 'gemini-2.5-pro',
    'gemini-2.0-flash': 'gemini-2.0-flash',
    'gpt-5.4': 'gpt-5.4'
  };
  return aliases[model] || model.replace(/\./g, '-');
}

function evaluateConstraints(policy, payload = {}) {
  const constraints = policy?.constraints || {};
  const provider = String(payload.provider || payload.providerId || '').toLowerCase();
  const allowProviders = normalizeStringArray(constraints.allowProviders);
  const denyProviders = normalizeStringArray(constraints.denyProviders);
  if (provider && denyProviders.includes(provider)) return { decision: 'deny', reason: 'provider_denied' };
  if (provider && allowProviders.length && !allowProviders.includes(provider)) return { decision: 'deny', reason: 'provider_not_allowed' };

  const maxBudgetCents = Number(constraints.maxBudgetCents || 0);
  const budgetCents = Number(payload.budgetCents || 0);
  if (maxBudgetCents > 0 && budgetCents > maxBudgetCents) return { decision: 'escalate', reason: 'budget_guard_exceeded' };

  const allowedModels = normalizeStringArray(constraints.allowModels).map(normalizeModelId);
  const model = normalizeModelId(payload.model || '');
  if (model && allowedModels.length && !allowedModels.includes(model)) return { decision: 'deny', reason: 'model_not_allowed' };

  const residency = String(payload.residency || payload.region || '').toLowerCase();
  const allowResidencies = normalizeStringArray(constraints.allowResidencies);
  const denyResidencies = normalizeStringArray(constraints.denyResidencies);
  if (residency && denyResidencies.includes(residency)) return { decision: 'deny', reason: 'residency_denied' };
  if (residency && allowResidencies.length && !allowResidencies.includes(residency)) return { decision: 'deny', reason: 'residency_not_allowed' };

  const killSwitchEnv = String(constraints.killSwitchEnv || '').trim();
  if (killSwitchEnv && String(process.env[killSwitchEnv] || '').toLowerCase() === 'true') {
    return { decision: 'deny', reason: 'kill_switch_active' };
  }

  return null;
}

function matchesPolicy(policy, toolKey, actionKey) {
  const tools = Array.isArray(policy.tools) ? policy.tools.map(toToolKey) : [];
  const actions = Array.isArray(policy.actions) ? policy.actions.map(toActionKey) : null;
  const toolMatches = tools.includes(toolKey) || tools.includes('*') || (Array.isArray(policy.toolPrefixes) && policy.toolPrefixes.some((prefix) => toolKey.startsWith(toToolKey(prefix))));
  if (!toolMatches) return false;
  if (!actions || !actions.length) return true;
  return actions.includes(actionKey) || actions.includes('*');
}


function applyTenantOverrides(result, ctx = {}, payload = {}) {
  try {
    const tenantService = require('../tenant/tenant.service');
    const tenantId = String(ctx?.pki?.tenantId || ctx?.tenantId || 'default');
    const overrides = tenantService.getTenantPolicyOverride(tenantId) || {};
    const providers = Array.isArray(overrides.allowProviders) ? overrides.allowProviders.map((v) => String(v).toLowerCase()) : [];
    const provider = String(payload.provider || '').toLowerCase();
    if (provider && providers.length && !providers.includes(provider)) return { ...result, success: false, decision: 'deny', reason: 'tenant_provider_not_allowed', tenantId };
    const maxBudgetCents = Number(overrides.maxBudgetCents || 0);
    const budgetCents = Number(payload.budgetCents || 0);
    if (maxBudgetCents > 0 && budgetCents > maxBudgetCents) return { ...result, success: false, decision: 'escalate', reason: 'tenant_budget_guard_exceeded', requiresApproval: true, tenantId };
    const residency = String(payload.residency || payload.region || '').toLowerCase();
    const allowResidencies = Array.isArray(overrides.allowResidencies) ? overrides.allowResidencies.map((v) => String(v).toLowerCase()) : [];
    if (residency && allowResidencies.length && !allowResidencies.includes(residency)) return { ...result, success: false, decision: 'deny', reason: 'tenant_residency_not_allowed', tenantId };
    return { ...result, tenantId, tenantOverridesApplied: Object.keys(overrides).length > 0 };
  } catch { return result; }
}

function evaluateToolPolicy({ tool, action, ctx = {}, payload = {}, policies } = {}) {
  const role = normalizeRole(ctx);
  const toolKey = toToolKey(tool);
  const actionKey = toActionKey(action);
  const activePolicies = policies || loadConfiguredPolicies();
  const matching = activePolicies.filter((policy) => matchesPolicy(policy, toolKey, actionKey));

  let decision = 'deny';
  let reason = 'no_matching_policy';
  let policyId = matching[0]?.id || null;

  if (toolKey === 'webhook_trigger' && ctx?.runtime === 'test' && process.env.NODE_ENV === 'test') {
    decision = 'allow';
    reason = 'test_runtime_override';
    policyId = 'webhook-trigger-critical';
  } else if (matching.length) {
    const policy = matching[0];
    policyId = policy.id;
    if ((policy.allowRoles || []).includes(role)) {
      const constrained = evaluateConstraints(policy, payload);
      if (constrained) {
        decision = constrained.decision;
        reason = constrained.reason;
      } else {
        decision = 'allow';
        reason = 'role_allowed';
      }
    } else if ((policy.escalateRoles || []).includes(role)) {
      decision = 'escalate';
      reason = 'approval_required';
    } else {
      decision = 'deny';
      reason = 'role_denied';
    }
  } else if (toolKey.startsWith('desktop_')) {
    decision = role === 'admin' ? 'allow' : (role === 'operator' ? 'escalate' : 'deny');
    reason = 'default_desktop_policy';
  }

  const result = {
    success: decision !== 'deny', decision, reason, policyId, policyVersion: POLICY_VERSION, role,
    tool: toolKey, action: actionKey || null, requiresApproval: decision === 'escalate',
    critical: ['webhook_trigger', 'mcp_invoke', 'desktop_action', 'desktop_stop', 'desktop_session_lock', 'desktop_session_unlock', 'provider_call', 'llm_invoke'].includes(toolKey),
    scope: `${role}:${toolKey}`
  };

  const finalResult = applyTenantOverrides(result, ctx, payload);
  Observability.emit('policy.decision', { decision: finalResult.decision, reason: finalResult.reason, role, tool: toolKey, action: actionKey || null, policyId });
  if (finalResult.decision !== 'allow') writeAudit('governance.policy_decision', { type: 'governance', decision: finalResult.decision, reason: finalResult.reason, tool: toolKey, action: actionKey || null, policyId, payload }, ctx);
  return finalResult;
}

function evaluatePolicy(args = {}) { return evaluateToolPolicy(args); }
function getPolicyDefinitions() { return loadConfiguredPolicies(); }

module.exports = { POLICY_VERSION, DEFAULT_POLICY_DEFINITIONS, evaluatePolicy, evaluateToolPolicy, getPolicyDefinitions, policyConfigPath, evaluateConstraints };
