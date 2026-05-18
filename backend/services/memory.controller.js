/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
/**
 * (c) 2026 KI-OS.org (v1.6.0) by Ingo Schaffer und Kimba
 * Datei: memory.controller.js
 * Diese Datei enthält JavaScript-Logik für Runtime, Services, Tools oder Tests innerhalb des KI-OS AgentMesh.
 * @license AGPL-3.0-only
 */

'use strict';
const crypto = require('node:crypto');
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

  function normalizeTags(...sources) {
    const tags = [];
    for (const source of sources) {
      if (Array.isArray(source)) {
        for (const entry of source) tags.push(entry);
      } else if (typeof source === 'string') {
        tags.push(source);
      }
    }
    return Array.from(new Set(tags
      .map((tag) => String(tag || '').trim().toLowerCase())
      .filter(Boolean)));
  }

  function summarizeText(text = '', maxLength = 160) {
    const clean = String(text || '').replace(/\s+/g, ' ').trim();
    if (!clean) return '';
    const sentence = clean.split(/(?<=[.!?])\s+/)[0] || clean;
    return sentence.length <= maxLength ? sentence : `${sentence.slice(0, maxLength - 1).trim()}…`;
  }

  function computeSourceHash({ sourcePath, text, memoryId }) {
    return crypto
      .createHash('sha1')
      .update(`${String(sourcePath || '')}::${String(memoryId || '')}::${String(text || '')}`)
      .digest('hex')
      .slice(0, 16);
  }

  function normalizeIngestJsonEntry(rawEntry = {}, fallback = {}) {
    const metadata = { ...(fallback.metadata || {}), ...(rawEntry.metadata || {}) };
    const sourceType = rawEntry.sourceType || fallback.sourceType || 'json_ingest';
    const sourcePath = rawEntry.sourcePath || metadata.sourcePath || fallback.sourcePath || null;
    const tags = normalizeTags(rawEntry.tags, metadata.tags, metadata.tag, fallback.tags);
    const summary = rawEntry.summary || metadata.summary || summarizeText(rawEntry.text);
    const sensitivity = rawEntry.sensitivity || metadata.sensitivity || fallback.sensitivity || 'internal';
    const consentStatus = rawEntry.consentStatus || metadata.consentStatus || fallback.consentStatus || 'curated';
    const sourceHash = rawEntry.sourceHash || metadata.sourceHash || computeSourceHash({
      sourcePath,
      text: rawEntry.text,
      memoryId: rawEntry.memoryId
    });

    return {
      ...rawEntry,
      sourceType,
      metadata: {
        ...metadata,
        sourceType,
        sourcePath,
        sourceHash,
        tags,
        summary,
        sensitivity,
        consentStatus
      }
    };
  }

  function buildAnnotatedItem(payload = {}, fallback = {}) {
    return annotateItem({
      memoryId: payload.memoryId,
      userId: payload.userId || fallback.userId || 'guest',
      tenantId: payload.tenantId || payload.metadata?.tenantId || fallback.tenantId || 'default',
      timestamp: String(payload.timestamp || fallback.timestamp || new Date().toISOString()),
      category: payload.category || fallback.category || 'chat',
      text: payload.text,
      traceId: payload.traceId || payload.metadata?.traceId || fallback.traceId || null,
      runId: payload.runId || payload.metadata?.runId || fallback.runId || null,
      sourceType: payload.sourceType || fallback.sourceType || 'memory',
      metadata: payload.metadata || {}
    });
  }

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

  async function findExistingBySourceHash(userId, tenantId, sourceHash) {
    const normalizedHash = String(sourceHash || '').trim();
    if (!normalizedHash) return null;
    const items = await memory.listByUser(userId, 500, { tenantId });
    return items.find((item) => item?.metadata?.sourceHash === normalizedHash) || null;
  }

  function buildLexicalFallback(items = [], query = '', limit = 10) {
    const q = String(query || '').trim().toLowerCase();
    if (!q) return [];
    const tokens = q.split(/\s+/).filter((token) => token.length > 2);
    return items
      .map((item) => {
        const haystack = JSON.stringify(item).toLowerCase();
        const matched = tokens.filter((token) => haystack.includes(token)).length;
        return { item, matched };
      })
      .filter((entry) => entry.matched > 0)
      .sort((a, b) => b.matched - a.matched)
      .slice(0, limit)
      .map(({ item, matched }) => ({
        memoryId: item.memoryId,
        text: item.text,
        category: item.category,
        timestamp: item.timestamp,
        provenance: item.semantic?.provenance || null,
        semantic: item.semantic || null,
        score: 0.24,
        relevance: Math.max(item.semantic?.relevance || 0, matched / Math.max(tokens.length, 1))
      }));
  }

  function normalizeFilterValues(value) {
    if (Array.isArray(value)) return value.map((entry) => String(entry || '').trim().toLowerCase()).filter(Boolean);
    if (typeof value === 'string') {
      return value.split(',').map((entry) => entry.trim().toLowerCase()).filter(Boolean);
    }
    return [];
  }

  function extractMemoryFilters(input = {}) {
    const category = typeof input.category === 'string' ? input.category.trim().toLowerCase() : '';
    const sourceType = typeof input.sourceType === 'string' ? input.sourceType.trim().toLowerCase() : '';
    const sensitivity = typeof input.sensitivity === 'string' ? input.sensitivity.trim().toLowerCase() : '';
    const tags = normalizeFilterValues(input.tags);
    return { category, sourceType, sensitivity, tags };
  }

  function hasMemoryFilters(filters = {}) {
    return Boolean(filters.category || filters.sourceType || filters.sensitivity || (filters.tags || []).length > 0);
  }

  function toAppliedFilters(filters = {}) {
    const applied = {};
    if (filters.category) applied.category = filters.category;
    if ((filters.tags || []).length > 0) applied.tags = filters.tags;
    if (filters.sourceType) applied.sourceType = filters.sourceType;
    if (filters.sensitivity) applied.sensitivity = filters.sensitivity;
    return applied;
  }

  function buildRetrieveSummary(items = [], appliedFilters = {}) {
    return {
      resultCount: Array.isArray(items) ? items.length : 0,
      hasFilters: Object.keys(appliedFilters || {}).length > 0
    };
  }

  function extractPagingOptions(input = {}) {
    const rawLimit = Number(input.limit ?? 20);
    const rawOffset = Number(input.offset ?? 0);
    const sortByRaw = typeof input.sortBy === 'string' ? input.sortBy.trim().toLowerCase() : '';
    const sortOrderRaw = typeof input.sortOrder === 'string' ? input.sortOrder.trim().toLowerCase() : '';
    const sortBy = ['timestamp', 'category', 'memoryid'].includes(sortByRaw) ? sortByRaw : '';
    const sortOrder = sortOrderRaw === 'asc' ? 'asc' : 'desc';
    return {
      limit: Number.isFinite(rawLimit) && rawLimit > 0 ? rawLimit : 20,
      offset: Number.isFinite(rawOffset) && rawOffset > 0 ? rawOffset : 0,
      sortBy,
      sortOrder
    };
  }

  function buildWindowLimit(paging = {}) {
    return Math.max((paging.limit || 20) + (paging.offset || 0), paging.limit || 20);
  }

  function sortMemoryItems(items = [], paging = {}) {
    if (!paging.sortBy) return items;
    const direction = paging.sortOrder === 'asc' ? 1 : -1;
    const sorted = items.slice();
    sorted.sort((left, right) => {
      let leftValue = '';
      let rightValue = '';

      if (paging.sortBy === 'timestamp') {
        leftValue = Date.parse(left?.timestamp || '') || 0;
        rightValue = Date.parse(right?.timestamp || '') || 0;
      } else if (paging.sortBy === 'category') {
        leftValue = String(left?.category || '').toLowerCase();
        rightValue = String(right?.category || '').toLowerCase();
      } else if (paging.sortBy === 'memoryid') {
        leftValue = String(left?.memoryId || '').toLowerCase();
        rightValue = String(right?.memoryId || '').toLowerCase();
      }

      if (leftValue < rightValue) return -1 * direction;
      if (leftValue > rightValue) return 1 * direction;
      return 0;
    });
    return sorted;
  }

  function paginateMemoryItems(items = [], paging = {}) {
    const offset = paging.offset || 0;
    const limit = paging.limit || items.length;
    return items.slice(offset, offset + limit);
  }

  function buildPaginationMeta(items = [], paging = {}) {
    const totalItems = Array.isArray(items) ? items.length : 0;
    const offset = paging.offset || 0;
    const limit = paging.limit || totalItems;
    const returnedItems = Math.max(0, Math.min(limit, Math.max(totalItems - offset, 0)));
    return {
      totalItems,
      returnedItems,
      limit,
      offset,
      hasMore: offset + returnedItems < totalItems,
      sortBy: paging.sortBy || null,
      sortOrder: paging.sortBy ? paging.sortOrder : null
    };
  }

  function applyMemoryFilters(items = [], filters = {}) {
    if (!hasMemoryFilters(filters)) return items;
    return items.filter((item) => {
      const category = String(item?.category || '').trim().toLowerCase();
      const metadata = item?.metadata || {};
      const sourceType = String(metadata.sourceType || item?.sourceType || item?.semantic?.provenance?.sourceType || '').trim().toLowerCase();
      const sensitivity = String(metadata.sensitivity || '').trim().toLowerCase();
      const tags = normalizeTags(metadata.tags, metadata.tag, item?.tags);

      if (filters.category && category !== filters.category) return false;
      if (filters.sourceType && sourceType !== filters.sourceType) return false;
      if (filters.sensitivity && sensitivity !== filters.sensitivity) return false;
      if ((filters.tags || []).length > 0 && !filters.tags.every((tag) => tags.includes(tag))) return false;
      return true;
    });
  }

  async function handleMemory(method, body = {}, { search } = {}) {
    try {
      if (method === 'GET') {
        const userId = search.get('userId');
        const tenantId = search.get('tenantId') || 'default';
        const q = search.get('q');
        const paging = extractPagingOptions({
          limit: search.get('limit'),
          offset: search.get('offset'),
          sortBy: search.get('sortBy'),
          sortOrder: search.get('sortOrder')
        });
        const limit = paging.limit;
        const windowLimit = buildWindowLimit(paging);
        const filters = extractMemoryFilters({
          category: search.get('category'),
          tags: search.get('tags'),
          sourceType: search.get('sourceType'),
          sensitivity: search.get('sensitivity')
        });
        const retrieveMode = search.get('retrieve');
        const memoryId = search.get('memoryId');
        if (!userId) return { error: 'UserId required' };
        if (memoryId) {
          const item = await memory.getById(userId, memoryId, { tenantId });
          return item ? { success: true, item, adapter: (await memory.health()).adapter } : { success: false, error: 'memory_not_found', memoryId };
        }
        if (search.get('graph') === 'true') {
          const items = await listSemanticItems(userId, tenantId, windowLimit, q);
          return { success: true, adapter: (await memory.health()).adapter, graph: buildGraph(items) };
        }
        if (retrieveMode === 'semantic' || search.get('semantic') === 'true') {
          const items = applyMemoryFilters(await listSemanticItems(userId, tenantId, windowLimit, q), filters);
          const response = retrieve(items, q || '', { limit: windowLimit });
          const appliedFilters = toAppliedFilters(filters);
          const sortedItems = sortMemoryItems(response.items || [], paging);
          const pagedItems = paginateMemoryItems(sortedItems, paging);
          Observability.emit('memory.retrieval.performed', { userId, query: q || '', total: response.total, limit, version: RETRIEVAL_API_VERSION });
          return {
            success: true,
            adapter: (await memory.health()).adapter,
            appliedFilters,
            summary: buildRetrieveSummary(pagedItems, appliedFilters),
            pagination: buildPaginationMeta(sortedItems, paging),
            ...response,
            items: pagedItems
          };
        }
        if (q) {
          const items = applyMemoryFilters(await listSemanticItems(userId, tenantId, windowLimit, q), filters);
          const appliedFilters = toAppliedFilters(filters);
          const sortedItems = sortMemoryItems(items, paging);
          const slicedItems = paginateMemoryItems(sortedItems, paging);
          return {
            items: slicedItems,
            adapter: (await memory.health()).adapter,
            appliedFilters,
            summary: buildRetrieveSummary(slicedItems, appliedFilters),
            pagination: buildPaginationMeta(sortedItems, paging)
          };
        }
        const listedItems = applyMemoryFilters(await memory.listByUser(userId, Math.max(windowLimit, 50), { tenantId }), filters);
        const appliedFilters = toAppliedFilters(filters);
        const sortedItems = sortMemoryItems(listedItems, paging);
        const pagedItems = paginateMemoryItems(sortedItems, paging);
        return {
          items: pagedItems,
          adapter: (await memory.health()).adapter,
          appliedFilters,
          summary: buildRetrieveSummary(pagedItems, appliedFilters),
          pagination: buildPaginationMeta(sortedItems, paging),
          semantic: {
            entitySchemaVersion: ENTITY_SCHEMA_VERSION,
            relationSchemaVersion: RELATION_SCHEMA_VERSION,
            retrievalVersion: RETRIEVAL_API_VERSION,
            graphRuntimeVersion: GRAPH_RUNTIME_VERSION
          }
        };
      }
      if (method === 'POST') {
        if (body.action === 'ingest_json') {
          const userId = body.userId || 'guest';
          const tenantId = body.tenantId || 'default';
          const sourceType = body.sourceType || 'json_ingest';
          const category = body.category || 'source-fragment';
          const sourcePath = body.sourcePath || body.metadata?.sourcePath || null;
          const tags = normalizeTags(body.tags, body.metadata?.tags, body.metadata?.tag);
          const sensitivity = body.sensitivity || body.metadata?.sensitivity || 'internal';
          const consentStatus = body.consentStatus || body.metadata?.consentStatus || 'curated';
          const entries = Array.isArray(body.items) ? body.items : Array.isArray(body.entries) ? body.entries : null;
          if (!entries || entries.length === 0) {
            return { success: false, error: 'items_required' };
          }

          const savedItems = [];
          let dedupedCount = 0;
          for (const rawEntry of entries) {
            if (!rawEntry || typeof rawEntry !== 'object') continue;
            if (typeof rawEntry.text !== 'string' || !rawEntry.text.trim()) continue;
            const normalizedEntry = normalizeIngestJsonEntry(rawEntry, {
              userId,
              tenantId,
              sourceType,
              category,
              sourcePath,
              tags,
              sensitivity,
              consentStatus,
              timestamp: body.timestamp,
              traceId: body.traceId || body.metadata?.traceId || null,
              runId: body.runId || body.metadata?.runId || null,
              metadata: body.metadata || {}
            });
            const existing = await findExistingBySourceHash(
              userId,
              tenantId,
              normalizedEntry.metadata?.sourceHash
            );
            if (existing) {
              dedupedCount += 1;
              savedItems.push(existing);
              continue;
            }
            const item = buildAnnotatedItem(normalizedEntry, {
              userId,
              tenantId,
              sourceType,
              category,
              timestamp: body.timestamp,
              traceId: body.traceId || body.metadata?.traceId || null,
              runId: body.runId || body.metadata?.runId || null
            });
            const saved = await memory.save(item);
            savedItems.push(saved);
            await emitMutation('memory.mutation.saved', saved, { mutation: 'ingest_json' });
          }

          if (savedItems.length === 0) {
            return { success: false, error: 'no_valid_items' };
          }

          return {
            success: true,
            adapter: (await memory.health()).adapter,
            mode: 'json_ingest',
            count: savedItems.length,
            dedupedCount,
            items: savedItems
          };
        }
        if (body.action === 'retrieve') {
          const userId = body.userId || 'guest';
          const tenantId = body.tenantId || 'default';
          const paging = extractPagingOptions(body);
          const limit = paging.limit;
          const windowLimit = buildWindowLimit(paging);
          const filters = extractMemoryFilters(body);
          let items = body.query
            ? await memory.search(userId, body.query, Math.max(windowLimit, 50), { tenantId })
            : await memory.listByUser(userId, Math.max(windowLimit, 50), { tenantId });
          if (body.query && (!Array.isArray(items) || items.length === 0)) {
            items = await memory.listByUser(userId, Math.max(windowLimit, 50), { tenantId });
          }
          items = applyMemoryFilters(items, filters);
          const appliedFilters = toAppliedFilters(filters);
          if (!body.query) {
            const sortedItems = sortMemoryItems(items, paging);
            const pagedItems = paginateMemoryItems(sortedItems, paging);
            Observability.emit('memory.retrieval.performed', { userId, query: '', total: sortedItems.length, limit, version: RETRIEVAL_API_VERSION });
            return {
              success: true,
              adapter: (await memory.health()).adapter,
              appliedFilters,
              summary: buildRetrieveSummary(pagedItems, appliedFilters),
              pagination: buildPaginationMeta(sortedItems, paging),
              total: sortedItems.length,
              items: pagedItems
            };
          }
          const response = retrieve(items, body.query || '', { limit: windowLimit });
          if ((response.items || []).length === 0 && body.query) {
            const fallbackItems = buildLexicalFallback(items, body.query, windowLimit);
            if (fallbackItems.length > 0) {
              response.total = fallbackItems.length;
              response.items = fallbackItems;
            }
          }
          const sortedItems = sortMemoryItems(response.items || [], paging);
          const pagedItems = paginateMemoryItems(sortedItems, paging);
          Observability.emit('memory.retrieval.performed', { userId, query: body.query || '', total: response.total, limit, version: RETRIEVAL_API_VERSION });
          return {
            success: true,
            adapter: (await memory.health()).adapter,
            appliedFilters,
            summary: buildRetrieveSummary(pagedItems, appliedFilters),
            pagination: buildPaginationMeta(sortedItems, paging),
            ...response,
            items: pagedItems
          };
        }
        if (body.action === 'graph') {
          const userId = body.userId || 'guest';
          const tenantId = body.tenantId || 'default';
          const items = await listSemanticItems(userId, tenantId, Number(body.limit || 50), body.query || '');
          return { success: true, adapter: (await memory.health()).adapter, graph: buildGraph(items) };
        }
        const item = buildAnnotatedItem(body);
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
