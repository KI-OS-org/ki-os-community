/**
 * (c) 2026 KI-OS.org (v6.0) by Ingo Schaffer und Kimba
 * Datei: memory.controller.js
 * Diese Datei enthält JavaScript-Logik für Runtime, Services, Tools oder Tests innerhalb des KI-OS AgentMesh.
 */

'use strict';
const { createMemoryAdapter } = require('../memory');
const Observability = require('./core/observability.service');
const logger = require('./core/logger.service');
const {
  annotateItem,
  retrieve,
  buildGraph,
  ENTITY_SCHEMA_VERSION,
  RELATION_SCHEMA_VERSION,
  RETRIEVAL_API_VERSION,
  GRAPH_RUNTIME_VERSION
} = require('./memory/semantic-memory.service');

function createMemoryController() {
  const memory = createMemoryAdapter();

  async function emitMutation(type, item, extra = {}) {
    Observability.emit(type, {
      memoryId: item.memoryId,
      userId: item.userId,
      category: item.category,
      entityCount: item.semantic?.entities?.length || 0,
      relationCount: item.semantic?.relations?.length || 0,
      provenance: item.semantic?.provenance || null,
      conflictCount: item.semantic?.conflicts?.length || 0,
      ...extra
    }, { runId: item.metadata?.runId || null });
  }

  async function listSemanticItems(userId, tenantId, limit, q) {
    return q ? await memory.search(userId, q, Math.max(limit, 50), { tenantId }) : await memory.listByUser(userId, Math.max(limit, 50), { tenantId });
  }

  async function handleMemory(method, body = {}, { search } = {}) {
    try {
      if (method === 'GET') {
        const userId = search.get('userId');
        const tenantId = search.get('tenantId') || 'default';
        const q = search.get('q');
        const limit = Number(search.get('limit') || 20);
        const retrieveMode = search.get('retrieve');
        const memoryId = search.get('memoryId');
        if (!userId) return { error: 'UserId required' };
        if (memoryId) {
          const item = await memory.getById(userId, memoryId, { tenantId });
          return item ? { success: true, item, adapter: (await memory.health()).adapter } : { success: false, error: 'memory_not_found', memoryId };
        }
        if (search.get('graph') === 'true') {
          const items = await listSemanticItems(userId, tenantId, limit, q);
          return { success: true, adapter: (await memory.health()).adapter, graph: buildGraph(items) };
        }
        if (retrieveMode === 'semantic' || search.get('semantic') === 'true') {
          const items = await listSemanticItems(userId, tenantId, limit, q);
          const response = retrieve(items, q || '', { limit });
          Observability.emit('memory.retrieval.performed', { userId, query: q || '', total: response.total, limit, version: RETRIEVAL_API_VERSION });
          return { success: true, adapter: (await memory.health()).adapter, ...response };
        }
        if (q) return { items: await memory.search(userId, q, limit, { tenantId }), adapter: (await memory.health()).adapter };
        return {
          items: await memory.listByUser(userId, limit, { tenantId }),
          adapter: (await memory.health()).adapter,
          semantic: {
            entitySchemaVersion: ENTITY_SCHEMA_VERSION,
            relationSchemaVersion: RELATION_SCHEMA_VERSION,
            retrievalVersion: RETRIEVAL_API_VERSION,
            graphRuntimeVersion: GRAPH_RUNTIME_VERSION
          }
        };
      }
      if (method === 'POST') {
        if (body.action === 'retrieve') {
          const userId = body.userId || 'guest';
          const tenantId = body.tenantId || 'default';
          const items = body.query ? await memory.search(userId, body.query, Math.max(Number(body.limit || 10), 50), { tenantId }) : await memory.listByUser(userId, Math.max(Number(body.limit || 10), 50), { tenantId });
          const response = retrieve(items, body.query || '', { limit: body.limit || 10 });
          Observability.emit('memory.retrieval.performed', { userId, query: body.query || '', total: response.total, limit: Number(body.limit || 10), version: RETRIEVAL_API_VERSION });
          return { success: true, adapter: (await memory.health()).adapter, ...response };
        }
        if (body.action === 'graph') {
          const userId = body.userId || 'guest';
          const tenantId = body.tenantId || 'default';
          const items = await listSemanticItems(userId, tenantId, Number(body.limit || 50), body.query || '');
          return { success: true, adapter: (await memory.health()).adapter, graph: buildGraph(items) };
        }
        const item = annotateItem({
          memoryId: body.memoryId,
          userId: body.userId || 'guest',
          tenantId: body.tenantId || body.metadata?.tenantId || 'default',
          timestamp: String(body.timestamp || new Date().toISOString()),
          category: body.category || 'chat',
          text: body.text,
          traceId: body.traceId || body.metadata?.traceId || null,
          runId: body.runId || body.metadata?.runId || null,
          sourceType: body.sourceType || 'memory',
          metadata: body.metadata || {}
        });
        const saved = await memory.save(item);
        await emitMutation('memory.mutation.saved', saved, { mutation: 'save' });
        if ((saved.semantic?.outcomeMarkers || []).length > 0) {
          await emitMutation('memory.outcome.marker.created', saved, {
            markers: saved.semantic.outcomeMarkers.map((marker) => ({
              expectedOutcomeKey: marker.expectedOutcomeKey || null,
              observedOutcomeKey: marker.observedOutcomeKey || null
            }))
          });
        }
        if ((saved.semantic?.conflicts || []).length > 0) {
          await emitMutation('memory.conflict.detected', saved, {
            conflicts: saved.semantic.conflicts.map((conflict) => ({ type: conflict.type, values: conflict.values }))
          });
        }
        return {
          success: true,
          item: saved,
          adapter: (await memory.health()).adapter,
          semantic: {
            entitySchemaVersion: ENTITY_SCHEMA_VERSION,
            relationSchemaVersion: RELATION_SCHEMA_VERSION,
            retrievalVersion: RETRIEVAL_API_VERSION,
            graphRuntimeVersion: GRAPH_RUNTIME_VERSION,
            entitiesDetected: saved.semantic?.entities?.length || 0,
            relationsDetected: saved.semantic?.relations?.length || 0,
            resolvedEntities: saved.semantic?.resolvedEntities?.length || 0,
            conflictsDetected: saved.semantic?.conflicts?.length || 0,
            provenanceIncluded: Boolean(saved.semantic?.provenance)
          }
        };
      }
      return { error: 'Unsupported method' };
    } catch (e) {
      logger.error('memory.error', { error: e?.message || String(e) });
      return { success: false, error: e.message };
    }
  }

  return { handleMemory };
}

module.exports = createMemoryController();
