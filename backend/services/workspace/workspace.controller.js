/**
 * KI-OS — (C) 2026 Ingo Schaffer
 * https://ki-os.org
 */

'use strict';
const fs = require('fs');
const path = require('path');
const { listRuns, getRun } = require('../ui/runtime.store');
const Observability = require('../core/observability.service');

const STORE_PATH = process.env.WORKSPACE_STORE_PATH || path.join(process.cwd(), '.ki-os-workspace.json');

const DEFAULT_STORE = {
  version: 'r18-v1',
  whiteboard: [],
  contexts: {},
  views: {}
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function readStore() {
  try {
    const parsed = JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
    return {
      version: parsed.version || DEFAULT_STORE.version,
      whiteboard: Array.isArray(parsed.whiteboard) ? parsed.whiteboard : [],
      contexts: parsed.contexts && typeof parsed.contexts === 'object' ? parsed.contexts : {},
      views: parsed.views && typeof parsed.views === 'object' ? parsed.views : {}
    };
  } catch {
    return clone(DEFAULT_STORE);
  }
}

function persistStore(store) {
  try {
    fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2));
  } catch {}
  return store;
}

function resetWorkspaceStore() {
  persistStore(clone(DEFAULT_STORE));
}

function inferTaskClass(input = {}) {
  const text = String(input.taskClass || input.task || input.prompt || input.query || '').toLowerCase();
  if (/(research|analyse|analysis|report|briefing|deep)/.test(text)) return 'research';
  if (/(ops|incident|recovery|governance|policy|supervisor|routing)/.test(text)) return 'operations';
  if (/(retail|kpi|campaign|pricing|seller|marketplace|commerce)/.test(text)) return 'commerce';
  return 'general';
}

function getTaskPatterns(taskClass = 'general') {
  const classes = {
    research: {
      panels: ['brief', 'sources', 'timeline', 'evidence', 'actions'],
      form: [
        { key: 'question', label: 'Research Question', type: 'text', required: true },
        { key: 'constraints', label: 'Constraints', type: 'textarea' },
        { key: 'depth', label: 'Depth', type: 'select', options: ['light', 'standard', 'deep'] }
      ]
    },
    operations: {
      panels: ['status', 'incidents', 'playbooks', 'approvals', 'actions'],
      form: [
        { key: 'objective', label: 'Operational Objective', type: 'text', required: true },
        { key: 'severity', label: 'Severity', type: 'select', options: ['low', 'medium', 'high'] },
        { key: 'owner', label: 'Owner', type: 'text' }
      ]
    },
    commerce: {
      panels: ['kpis', 'campaigns', 'pricing', 'seller', 'decisions'],
      form: [
        { key: 'businessGoal', label: 'Business Goal', type: 'text', required: true },
        { key: 'timeframe', label: 'Timeframe', type: 'text' },
        { key: 'market', label: 'Market', type: 'text' }
      ]
    },
    general: {
      panels: ['chat', 'context', 'files', 'notes'],
      form: [
        { key: 'goal', label: 'Goal', type: 'text', required: true },
        { key: 'details', label: 'Details', type: 'textarea' }
      ]
    }
  };
  return classes[taskClass] || classes.general;
}

function summarizeRole(role = 'user') {
  return {
    role,
    mode: role === 'operator' || role === 'admin' ? 'operator' : 'user',
    canApprove: role === 'admin' || role === 'operator',
    canEditWhiteboard: role !== 'viewer'
  };
}

function getWorkspacePayload(input = {}, ctx = {}) {
  const store = readStore();
  const role = String(ctx?.pki?.role || input.role || 'user').toLowerCase();
  const taskClass = inferTaskClass(input);
  const patterns = getTaskPatterns(taskClass);
  const runId = input.runId || null;
  const run = runId ? getRun(runId) : null;
  const recentRuns = listRuns(10).slice(0, 5).map((item) => ({
    runId: item.runId,
    status: item.status,
    task: item.task || item.type || 'task',
    taskClass: inferTaskClass(item),
    updatedAt: item.updatedAt
  }));
  const whiteboard = store.whiteboard.slice(-20).reverse();

  const payload = {
    success: true,
    version: '6.2.8-r18-digital-workspace-universal-interface',
    workspace: {
      taskClass,
      role: summarizeRole(role),
      title: input.title || `${taskClass[0].toUpperCase()}${taskClass.slice(1)} Workspace`,
      context: store.contexts[ctx?.pki?.userId || input.userId || 'guest'] || {},
      panels: patterns.panels,
      form: patterns.form,
      whiteboardEnabled: true,
      generatedForm: true,
      sharedWhiteboard: whiteboard,
      currentRun: run ? {
        runId: run.runId,
        status: run.status,
        task: run.task || run.type || 'task',
        expectedOutcomeKey: run.expectedOutcomeKey || null,
        observedOutcomeKey: run.observedOutcomeKey || null
      } : null,
      recentRuns
    }
  };
  return payload;
}

function addWhiteboardEntry(body = {}, ctx = {}) {
  const store = readStore();
  const entry = {
    id: `wb_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    text: String(body.text || '').trim(),
    x: Number(body.x || 0),
    y: Number(body.y || 0),
    color: body.color || 'blue',
    by: ctx?.pki?.userId || 'guest',
    role: ctx?.pki?.role || 'user',
    timestamp: new Date().toISOString()
  };
  if (!entry.text) {
    const error = new Error('whiteboard_text_required');
    error.statusCode = 400;
    throw error;
  }
  store.whiteboard.push(entry);
  persistStore(store);
  Observability.emit('workspace.whiteboard.updated', { entryId: entry.id, by: entry.by, role: entry.role });
  return { success: true, entry, items: store.whiteboard.slice(-50).reverse() };
}

function updateWorkspaceContext(body = {}, ctx = {}) {
  const store = readStore();
  const userId = ctx?.pki?.userId || body.userId || 'guest';
  store.contexts[userId] = Object.assign({}, store.contexts[userId] || {}, body.context || {});
  persistStore(store);
  Observability.emit('workspace.context.updated', { userId, keys: Object.keys(body.context || {}) });
  return { success: true, userId, context: store.contexts[userId] };
}

async function handleWorkspaceRequest(pathname, method, body = {}, ctx = {}) {
  if (pathname === '/workspace' && method === 'GET') {
    return { statusCode: 200, body: getWorkspacePayload(body, ctx) };
  }
  if (pathname === '/workspace/context' && method === 'GET') {
    const store = readStore();
    const userId = ctx?.pki?.userId || 'guest';
    return { statusCode: 200, body: { success: true, userId, context: store.contexts[userId] || {} } };
  }
  if (pathname === '/workspace/context' && method === 'POST') {
    return { statusCode: 200, body: updateWorkspaceContext(body, ctx) };
  }
  if (pathname === '/workspace/whiteboard' && method === 'GET') {
    return { statusCode: 200, body: { success: true, items: readStore().whiteboard.slice(-50).reverse() } };
  }
  if (pathname === '/workspace/whiteboard' && method === 'POST') {
    return { statusCode: 200, body: addWhiteboardEntry(body, ctx) };
  }
  if (pathname.startsWith('/workspace/forms/') && method === 'GET') {
    const taskClass = pathname.split('/').pop();
    return { statusCode: 200, body: { success: true, taskClass, form: getTaskPatterns(taskClass).form } };
  }
  return { statusCode: 404, body: { success: false, error: 'workspace_not_found' } };
}

module.exports = {
  handleWorkspaceRequest,
  getWorkspacePayload,
  inferTaskClass,
  getTaskPatterns,
  resetWorkspaceStore
};
