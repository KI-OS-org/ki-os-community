/**
 * KI-OS — (C) 2026 Ingo Schaffer
 * https://ki-os.org
 */
/**
 * KI-OS Agent Registry Service
 * Verwaltet benutzerdefinierte Agents: CRUD, Kategorien, Rollen-Sichtbarkeit, Status.
 * Storage: .ki-os-agents.json im Root-Verzeichnis.
 */

const fs   = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');

const REGISTRY_PATH = path.join(__dirname, '../../../.ki-os-agents.json');

const DEFAULT_CATEGORIES = ['Marketing', 'Sales', 'IT', 'Finance', 'Operations', 'Admin'];
const DOMAIN_MAP = {
  Marketing:  'marketing',
  Sales:      'executive',
  IT:         'it',
  Finance:    'executive',
  Operations: 'retail',
  Admin:      'executive',
};

// ---------------------------------------------------------------------------
// Storage helpers
// ---------------------------------------------------------------------------
function load() {
  try {
    if (!fs.existsSync(REGISTRY_PATH)) return { agents: [], version: 1 };
    return JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));
  } catch {
    return { agents: [], version: 1 };
  }
}

function save(store) {
  fs.writeFileSync(REGISTRY_PATH, JSON.stringify(store, null, 2), 'utf8');
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------
function listAgents({ category, status, visibleTo, search } = {}) {
  const { agents } = load();
  let result = agents.filter(a => a.status !== 'deleted');

  if (category)  result = result.filter(a => a.category === category);
  if (status)    result = result.filter(a => a.status === status);
  if (visibleTo) result = result.filter(a =>
    a.visibleTo.includes(visibleTo) || a.visibleTo.includes('Admin')
  );
  if (search) {
    const q = search.toLowerCase();
    result = result.filter(a =>
      a.name.toLowerCase().includes(q) ||
      (a.description || '').toLowerCase().includes(q) ||
      (a.tags || []).some(t => t.toLowerCase().includes(q))
    );
  }
  return result;
}

function getAgent(id) {
  const { agents } = load();
  return agents.find(a => a.id === id) || null;
}

function createAgent(data) {
  const store = load();

  const now = new Date().toISOString();
  const agent = {
    id:          randomUUID(),
    name:        data.name,
    category:    data.category || 'Admin',
    subCategory: data.subCategory || '',
    owner:       data.owner || '',
    status:      'active',
    domain:      data.domain || DOMAIN_MAP[data.category] || 'executive',
    description: data.description || '',
    tags:        Array.isArray(data.tags) ? data.tags : [],
    systemPrompt: data.systemPrompt || '',
    tools:       Array.isArray(data.tools) ? data.tools : ['web_search', 'memory_search'],
    visibleTo:   Array.isArray(data.visibleTo) ? data.visibleTo : [data.category || 'Admin', 'Admin'],
    createdAt:   now,
    updatedAt:   now,
    lastRun:     null,
    runCount:    0,
    errorCount:  0,
  };
  store.agents.push(agent);
  save(store);
  return agent;
}

function updateAgent(id, data) {
  const store = load();
  const idx = store.agents.findIndex(a => a.id === id);
  if (idx === -1) return null;
  const allowed = ['name','category','subCategory','owner','description','tags',
                   'systemPrompt','tools','visibleTo','domain'];
  allowed.forEach(key => {
    if (data[key] !== undefined) store.agents[idx][key] = data[key];
  });
  store.agents[idx].updatedAt = new Date().toISOString();
  save(store);
  return store.agents[idx];
}

function toggleAgent(id) {
  const store = load();
  const idx = store.agents.findIndex(a => a.id === id);
  if (idx === -1) return null;
  const current = store.agents[idx].status;
  store.agents[idx].status = current === 'active' ? 'paused' : 'active';
  store.agents[idx].updatedAt = new Date().toISOString();
  save(store);
  return store.agents[idx];
}

function deleteAgent(id) {
  const store = load();
  const idx = store.agents.findIndex(a => a.id === id);
  if (idx === -1) return false;
  store.agents[idx].status = 'deleted';
  store.agents[idx].updatedAt = new Date().toISOString();
  save(store);
  return true;
}

// ---------------------------------------------------------------------------
// Stats (für Dashboard Heatmap)
// ---------------------------------------------------------------------------
function getStats() {
  const { agents } = load();
  const live = agents.filter(a => a.status !== 'deleted');

  const byCategory = {};
  DEFAULT_CATEGORIES.forEach(c => { byCategory[c] = { total: 0, active: 0, paused: 0, idle: 0, error: 0 }; });

  live.forEach(a => {
    if (!byCategory[a.category]) {
      byCategory[a.category] = { total: 0, active: 0, paused: 0, idle: 0, error: 0 };
    }
    byCategory[a.category].total++;
    byCategory[a.category][a.status] = (byCategory[a.category][a.status] || 0) + 1;
  });

  return {
    total:      live.length,
    active:     live.filter(a => a.status === 'active').length,
    paused:     live.filter(a => a.status === 'paused').length,
    idle:       live.filter(a => a.status === 'idle').length,
    error:      live.filter(a => a.status === 'error').length,
    byCategory,
    categories: DEFAULT_CATEGORIES,
  };
}

// ---------------------------------------------------------------------------
// Request handler (für core/app.js)
// ---------------------------------------------------------------------------
function handleAgentRegistryRequest(path, method, body = {}) {
  // GET /agents/stats
  if (path === '/agents/stats' && method === 'GET') {
    return { statusCode: 200, body: getStats() };
  }

  // GET /agents
  if (path === '/agents' && method === 'GET') {
    const agents = listAgents({
      category:  body.category,
      status:    body.status,
      visibleTo: body.visibleTo,
      search:    body.search,
    });
    return { statusCode: 200, body: { agents, total: agents.length } };
  }

  // POST /agents
  if (path === '/agents' && method === 'POST') {
    if (!body.name) return { statusCode: 400, body: { error: 'name required' } };
    try {
      const agent = createAgent(body);
      return { statusCode: 201, body: agent };
    } catch (err) {
      if (err.code === 'COMMUNITY_LIMIT_EXCEEDED') {
        return { statusCode: 403, body: { error: err.message, code: err.code, limit: err.limit } };
      }
      throw err;
    }
  }

  // GET /agents/:id
  const matchGet = path.match(/^\/agents\/([^/]+)$/);
  if (matchGet && method === 'GET') {
    const agent = getAgent(matchGet[1]);
    if (!agent) return { statusCode: 404, body: { error: 'not found' } };
    return { statusCode: 200, body: agent };
  }

  // PUT /agents/:id
  const matchPut = path.match(/^\/agents\/([^/]+)$/);
  if (matchPut && method === 'PUT') {
    const agent = updateAgent(matchPut[1], body);
    if (!agent) return { statusCode: 404, body: { error: 'not found' } };
    return { statusCode: 200, body: agent };
  }

  // POST /agents/:id/toggle
  const matchToggle = path.match(/^\/agents\/([^/]+)\/toggle$/);
  if (matchToggle && method === 'POST') {
    const agent = toggleAgent(matchToggle[1]);
    if (!agent) return { statusCode: 404, body: { error: 'not found' } };
    return { statusCode: 200, body: agent };
  }

  // DELETE /agents/:id
  const matchDel = path.match(/^\/agents\/([^/]+)$/);
  if (matchDel && method === 'DELETE') {
    const ok = deleteAgent(matchDel[1]);
    if (!ok) return { statusCode: 404, body: { error: 'not found' } };
    return { statusCode: 200, body: { success: true } };
  }

  return { statusCode: 404, body: { error: 'not found' } };
}

module.exports = {
  handleAgentRegistryRequest,
  listAgents, getAgent, createAgent, updateAgent, toggleAgent, deleteAgent, getStats,
};
