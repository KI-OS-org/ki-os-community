/**
 * (c) 2026 KI-OS.org (v6.0) by Ingo Schaffer und Kimba
 * Datei: domain.router.js
 * Diese Datei enthält JavaScript-Logik für Runtime, Services, Tools oder Tests innerhalb des KI-OS AgentMesh.
 */

'use strict';
const { getDomainAgent, listDomainAgents } = require('./domain.agents');

function inferDomainAgent(task = {}, body = {}) {
  if (body.domainAgent) return body.domainAgent;
  const q = String(task.task || '').toLowerCase();
  if (/retail|handel|loyalty|markt|filiale|e-commerce/i.test(q)) return 'retail';
  if (/marketing|kampagne|brand|positionierung|target group|zielgruppe/i.test(q)) return 'marketing';
  if (/architektur|it|api|aws|lambda|security|integration/i.test(q)) return 'it';
  if (task.domain === 'academic' || /phd|promotion|forschung|quelle|paper/i.test(q)) return 'research';
  return process.env.DOMAIN_AGENT_DEFAULT || 'executive';
}

function routeDomainTask(task = {}, body = {}) {
  const selected = inferDomainAgent(task, body);
  const agent = getDomainAgent(selected) || getDomainAgent(process.env.DOMAIN_AGENT_FALLBACK || 'executive');
  return {
    selected,
    available: listDomainAgents().map(a => a.id),
    enrichment: agent ? agent.enrich(task, body) : {}
  };
}

module.exports = { inferDomainAgent, routeDomainTask };
