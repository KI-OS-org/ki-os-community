/**
 * KI-OS — (C) 2026 Ingo Schaffer
 * https://ki-os.org
 */
'use strict';

const crypto = require('crypto');

const ENTITY_SCHEMA_VERSION = 'v2';
const RELATION_SCHEMA_VERSION = 'v2';
const RETRIEVAL_API_VERSION = 'v2';
const GRAPH_RUNTIME_VERSION = 'v1';
const RETRIEVAL_THRESHOLD = Number(process.env.SEMANTIC_MEMORY_RETRIEVAL_THRESHOLD || 0.24);

const COMPANY_SUFFIX_PATTERN = '(?:gmbh|ag|se|inc|corp|ltd|group|digital|holding)';

const ENTITY_PATTERNS = [
  { type: 'person', regex: /\b(?:ich bin|mein name ist|i am|name is)\s+([a-zäöüß][\p{L}'-]+(?:\s+[a-zäöüß][\p{L}'-]+){0,2})/giu },
  { type: 'person', regex: /\b([a-zäöüß][\p{L}'-]+(?:\s+[a-zäöüß][\p{L}'-]+){0,2})\s+(?:arbeitet bei|arbeitet für|working at|working for)\b/giu },
  { type: 'company', regex: new RegExp(String.raw`\b(?:bei|für|from|at|arbeite bei|arbeite für|working at|working for)\s+([a-z][\w&.-]+(?:\s+[a-z][\w&.-]+){0,3}(?:\s+${COMPANY_SUFFIX_PATTERN})?)`, 'giu') },
  { type: 'project', regex: /\b(?:projekt|roadmap|initiative|programm|program|release|sprint)\s+(?:ist|is|named|heisst|heißt|namens|called)?\s*([a-z0-9][\w.-]{1,40})/giu },
  { type: 'location', regex: /\b(?:in|aus|bei)\s+([a-zäöüß][\p{L}.-]+(?:\s+[a-zäöüß][\p{L}.-]+){0,2})/giu },
  { type: 'product', regex: /\b(?:produkt|tool|plattform|system|modell)\s+([a-z0-9][\w.+-]{1,40})/giu },
  { type: 'outcome_metric', regex: /\b(?:conversion|redeem rate|clv|margin|umsatz|revenue|roi|latency|kosten|error rate|out-of-stock-quote|throughput|preis optimierung|price optimization)\b/giu }
];

const RELATION_PATTERNS = [
  { type: 'works_for', regex: /\b(?:arbeite bei|arbeite für|working at|working for|bei)\s+([a-z][\w&.-]+(?:\s+[a-z][\w&.-]+){0,3})/giu },
  { type: 'owns_project', regex: /\b(?:projekt|initiative|programm|roadmap)\s+([a-z0-9][\w.-]{1,40})/giu },
  { type: 'prefers', regex: /\b(?:bevorzuge|prefer|möchte|will)\s+([^.,;\n]{3,80})/giu },
  { type: 'located_in', regex: /\b(?:in|aus)\s+([a-zäöüß][\p{L}.-]+(?:\s+[a-zäöüß][\p{L}.-]+){0,2})/giu },
  { type: 'tracks_metric', regex: /\b(?:kpi|metrik|metric|ziel|outcome)\s*:?\s*([^.,;\n]{3,80})/giu }
];

function asString(value) {
  return String(value || '').trim();
}

function titleCase(value) {
  return asString(value)
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

function normalizeEntityValue(type, value) {
  const raw = asString(value).replace(/\s+/g, ' ').trim();
  if (!raw) return '';
  if (type === 'company') {
    return raw
      .replace(/\b(gmbh|ag|se|inc|corp|ltd|group|digital|holding)\b/gi, (m) => m.toUpperCase() === 'AG' || m.toUpperCase() === 'SE' ? m.toUpperCase() : titleCase(m))
      .split(/\s+/)
      .map((part) => /^(AG|SE|GmbH|Inc|Corp|Ltd|Group|Digital|Holding)$/i.test(part) ? part : titleCase(part))
      .join(' ');
  }
  if (type === 'person' || type === 'location') return titleCase(raw);
  if (type === 'project' || type === 'product') return raw.replace(/\s+/g, '-');
  return raw.toLowerCase();
}

function slug(value) {
  return asString(value)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'unknown';
}

function normalizeTimestamp(value) {
  const ts = value ? new Date(value) : new Date();
  if (Number.isNaN(ts.getTime())) return new Date().toISOString();
  return ts.toISOString();
}

function hashText(text) {
  return crypto.createHash('sha1').update(asString(text)).digest('hex').slice(0, 16);
}

function buildProvenance(item = {}) {
  return {
    sourceType: item.sourceType || 'memory',
    sourceId: item.memoryId || item.id || `${item.userId || 'guest'}:${item.timestamp || 'unknown'}`,
    timestamp: normalizeTimestamp(item.timestamp),
    traceId: item.traceId || item.metadata?.traceId || null,
    runId: item.runId || item.metadata?.runId || null,
    category: item.category || 'chat',
    evidenceHash: hashText(`${item.userId || 'guest'}:${item.text || ''}`)
  };
}

function detectOutcomeMarkers(item = {}) {
  const metadata = item.metadata || {};
  const markers = [];
  if (metadata.expectedOutcomeKey || metadata.observedOutcomeKey) {
    markers.push({
      expectedOutcomeKey: metadata.expectedOutcomeKey || null,
      observedOutcomeKey: metadata.observedOutcomeKey || null,
      confidence: Number(metadata.outcomeConfidence || metadata.confidence || 0),
      signalSource: metadata.signalSource || 'memory.metadata'
    });
  }
  if (metadata.outcome && typeof metadata.outcome === 'object') {
    markers.push({
      expectedOutcomeKey: metadata.outcome.expectedOutcomeKey || null,
      observedOutcomeKey: metadata.outcome.observedOutcomeKey || null,
      confidence: Number(metadata.outcome.confidence || 0),
      signalSource: metadata.outcome.signalSource || 'memory.outcome'
    });
  }
  return markers.filter((marker) => marker.expectedOutcomeKey || marker.observedOutcomeKey);
}

function scoreEntity(type, value, item = {}) {
  let relevance = 0.55;
  if (item.category === 'profile' || item.category === 'identity') relevance += 0.15;
  if (type === 'person' || type === 'company') relevance += 0.15;
  if (type === 'outcome_metric') relevance += 0.1;
  if (String(value).length > 20) relevance -= 0.05;
  return Number(Math.max(0.2, Math.min(0.99, relevance)).toFixed(2));
}

function scoreConfidence(type, value, item = {}) {
  let confidence = 0.5;
  if (item.metadata?.verified) confidence += 0.2;
  if (type === 'outcome_metric') confidence += 0.1;
  if (/^[A-ZÄÖÜ]/.test(titleCase(String(value || '')))) confidence += 0.1;
  return Number(Math.max(0.2, Math.min(0.98, confidence)).toFixed(2));
}

function dedupeByKey(items, keyFn) {
  const seen = new Set();
  const deduped = [];
  for (const item of items) {
    const key = keyFn(item);
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(item);
  }
  return deduped;
}

function extractEntities(text = '', item = {}) {
  const content = asString(text);
  const entities = [];
  for (const pattern of ENTITY_PATTERNS) {
    const regex = new RegExp(pattern.regex);
    let match;
    while ((match = regex.exec(content)) !== null) {
      const rawValue = asString(match[1] || match[0]);
      const value = normalizeEntityValue(pattern.type, rawValue);
      if (!value || value.length < 2) continue;
      entities.push({
        entityId: `${pattern.type}:${slug(value)}`,
        type: pattern.type,
        value,
        normalizedValue: slug(value),
        aliases: dedupeByKey([rawValue, value].filter(Boolean).map((entry) => ({ value: entry })), (entry) => slug(entry.value)).map((entry) => entry.value),
        relevance: scoreEntity(pattern.type, value, item),
        confidence: scoreConfidence(pattern.type, value, item),
        firstSeenAt: normalizeTimestamp(item.timestamp),
        lastSeenAt: normalizeTimestamp(item.timestamp)
      });
    }
  }
  return dedupeByKey(entities, (entry) => `${entry.type}:${entry.normalizedValue}`);
}

function extractRelations(text = '', item = {}, entities = []) {
  const content = asString(text);
  const subject = asString(item.userId || item.metadata?.subject || 'guest');
  const relations = [];
  for (const pattern of RELATION_PATTERNS) {
    const regex = new RegExp(pattern.regex);
    let match;
    while ((match = regex.exec(content)) !== null) {
      const targetRaw = asString(match[1] || match[0]);
      const targetValue = normalizeEntityValue('company', targetRaw) || targetRaw;
      if (!targetValue || targetValue.length < 2) continue;
      const targetEntity = entities.find((entity) => entity.normalizedValue === slug(targetValue) || entity.aliases?.some((alias) => slug(alias) === slug(targetRaw)));
      relations.push({
        relationId: `${slug(subject)}:${pattern.type}:${slug(targetValue)}`,
        type: pattern.type,
        subjectId: `user:${slug(subject)}`,
        objectId: targetEntity ? targetEntity.entityId : `value:${slug(targetValue)}`,
        objectValue: targetValue,
        relevance: Number((targetEntity?.relevance || 0.65).toFixed(2)),
        timestamp: normalizeTimestamp(item.timestamp)
      });
    }
  }
  return dedupeByKey(relations, (entry) => entry.relationId);
}

function resolveEntities(entities = []) {
  const buckets = new Map();
  for (const entity of entities) {
    const key = `${entity.type}:${entity.normalizedValue}`;
    const bucket = buckets.get(key) || {
      canonicalEntityId: entity.entityId,
      type: entity.type,
      canonicalValue: entity.value,
      normalizedValue: entity.normalizedValue,
      aliases: new Set(),
      confidence: 0,
      relevance: 0,
      sources: 0
    };
    (entity.aliases || [entity.value]).forEach((alias) => bucket.aliases.add(alias));
    bucket.confidence = Math.max(bucket.confidence, Number(entity.confidence || 0));
    bucket.relevance = Math.max(bucket.relevance, Number(entity.relevance || 0));
    bucket.sources += 1;
    buckets.set(key, bucket);
  }
  return Array.from(buckets.values()).map((bucket) => ({
    canonicalEntityId: bucket.canonicalEntityId,
    type: bucket.type,
    canonicalValue: bucket.canonicalValue,
    normalizedValue: bucket.normalizedValue,
    aliases: Array.from(bucket.aliases),
    confidence: Number(bucket.confidence.toFixed(2)),
    relevance: Number(bucket.relevance.toFixed(2)),
    sourceCount: bucket.sources
  }));
}

function buildConflictSet(item = {}, resolvedEntities = [], relations = []) {
  const conflicts = [];
  const conflictRules = [
    { kind: 'works_for_conflict', relationType: 'works_for', entityType: 'company' },
    { kind: 'located_in_conflict', relationType: 'located_in', entityType: 'location' },
    { kind: 'person_identity_conflict', relationType: null, entityType: 'person' }
  ];
  for (const rule of conflictRules) {
    const candidates = rule.relationType
      ? relations.filter((relation) => relation.type === rule.relationType).map((relation) => relation.objectValue)
      : resolvedEntities.filter((entity) => entity.type === rule.entityType).map((entity) => entity.canonicalValue);
    const uniqueValues = dedupeByKey(candidates.filter(Boolean).map((value) => ({ value })), (entry) => slug(entry.value)).map((entry) => entry.value);
    if (uniqueValues.length > 1) {
      conflicts.push({
        type: rule.kind,
        severity: 'medium',
        values: uniqueValues,
        status: 'separated',
        explanation: `Mehrere Werte für ${rule.entityType} erkannt: ${uniqueValues.join(', ')}`
      });
    }
  }
  return conflicts;
}

function buildOutcomeContext(item = {}, outcomeMarkers = []) {
  const metadata = item.metadata || {};
  return {
    expectedOutcomeKey: metadata.expectedOutcomeKey || metadata.outcome?.expectedOutcomeKey || null,
    observedOutcomeKey: metadata.observedOutcomeKey || metadata.outcome?.observedOutcomeKey || null,
    confidence: Number(metadata.outcomeConfidence || metadata.outcome?.confidence || 0),
    markerCount: outcomeMarkers.length,
    active: outcomeMarkers.length > 0
  };
}

function freshnessBoost(item = {}) {
  const occurredAt = item.semantic?.timeContext?.occurredAt || item.timestamp;
  const ts = new Date(occurredAt || 0).getTime();
  if (!Number.isFinite(ts) || ts <= 0) return 0;
  const ageDays = Math.max(0, (Date.now() - ts) / 86400000);
  return Number(Math.max(0, 0.08 - Math.min(0.08, ageDays * 0.002)).toFixed(4));
}

function scoreRetrieval(item = {}, query = '') {
  const q = asString(query).toLowerCase();
  const text = asString(item.text).toLowerCase();
  let score = 0;
  const reasons = [];
  if (!q) {
    score += 0.2;
    reasons.push('empty-query-default');
  }
  if (q && text.includes(q)) {
    score += 0.56;
    reasons.push('text-match');
  }

  const entityHits = Array.isArray(item.semantic?.entities)
    ? item.semantic.entities.filter((entity) => `${entity.type} ${entity.value} ${entity.normalizedValue} ${(entity.aliases || []).join(' ')}`.toLowerCase().includes(q)).length
    : 0;
  if (entityHits) reasons.push(`entity-hits:${entityHits}`);
  score += Math.min(0.22, entityHits * 0.08);

  const relationHits = Array.isArray(item.semantic?.relations)
    ? item.semantic.relations.filter((relation) => `${relation.type} ${relation.objectValue || ''}`.toLowerCase().includes(q)).length
    : 0;
  if (relationHits) reasons.push(`relation-hits:${relationHits}`);
  score += Math.min(0.1, relationHits * 0.05);

  const outcomeMarkers = Array.isArray(item.semantic?.outcomeMarkers) ? item.semantic.outcomeMarkers : [];
  const outcomeHit = outcomeMarkers.some((marker) => `${marker.expectedOutcomeKey || ''} ${marker.observedOutcomeKey || ''} ${marker.signalSource || ''}`.toLowerCase().includes(q));
  if (outcomeHit) {
    score += 0.14;
    reasons.push('outcome-hit');
  }
  if (outcomeMarkers.length) {
    score += 0.04;
    reasons.push('outcome-context');
  }

  const conflicts = item.semantic?.conflicts || [];
  if (conflicts.length) {
    score -= 0.04;
    reasons.push('conflict-penalty');
  }

  score += Number(item.semantic?.relevance || 0) * 0.35;
  score += freshnessBoost(item);
  return {
    score: Number(Math.min(1, Math.max(0, score)).toFixed(4)),
    reasons,
    confidence: Number(Math.min(0.99, 0.42 + Number(item.semantic?.relevance || 0) * 0.35 + (outcomeMarkers.length ? 0.06 : 0) - (conflicts.length ? 0.05 : 0)).toFixed(2))
  };
}

function annotateItem(item = {}) {
  const text = asString(item.text);
  const entities = extractEntities(text, item);
  const relations = extractRelations(text, item, entities);
  const resolvedEntities = resolveEntities(entities);
  const conflicts = buildConflictSet(item, resolvedEntities, relations);
  const outcomeMarkers = detectOutcomeMarkers(item);
  const outcomeContext = buildOutcomeContext(item, outcomeMarkers);
  const semantic = {
    schemaVersion: ENTITY_SCHEMA_VERSION,
    relationSchemaVersion: RELATION_SCHEMA_VERSION,
    graphRuntimeVersion: GRAPH_RUNTIME_VERSION,
    relevance: Number((entities.reduce((sum, entity) => sum + Number(entity.relevance || 0), 0) / Math.max(1, entities.length)).toFixed(2)),
    entities,
    resolvedEntities,
    relations,
    conflicts,
    outcomeMarkers,
    outcomeContext,
    provenance: buildProvenance(item),
    timeContext: {
      occurredAt: normalizeTimestamp(item.timestamp),
      lastAccessedAt: null,
      freshnessDays: 0
    },
    fingerprint: hashText(`${item.userId || 'guest'}:${text}`)
  };
  return { ...item, semantic };
}

function summarizeSchema(items = []) {
  const entities = [];
  const resolvedEntities = [];
  const relations = [];
  const conflicts = [];
  for (const item of items) {
    if (Array.isArray(item.semantic?.entities)) entities.push(...item.semantic.entities);
    if (Array.isArray(item.semantic?.resolvedEntities)) resolvedEntities.push(...item.semantic.resolvedEntities);
    if (Array.isArray(item.semantic?.relations)) relations.push(...item.semantic.relations);
    if (Array.isArray(item.semantic?.conflicts)) conflicts.push(...item.semantic.conflicts);
  }
  const dedupedRelations = dedupeByKey(relations, (item) => item.relationId);
  const aggregateConflicts = [];
  const byRelationType = new Map();
  for (const relation of dedupedRelations) {
    const key = relation.type;
    const bucket = byRelationType.get(key) || new Set();
    bucket.add(relation.objectValue);
    byRelationType.set(key, bucket);
  }
  for (const [type, values] of byRelationType.entries()) {
    if ((type === 'works_for' || type === 'located_in') && values.size > 1) {
      aggregateConflicts.push({
        type: `${type}_aggregate_conflict`,
        severity: 'medium',
        values: Array.from(values),
        status: 'separated',
        explanation: `Mehrere Werte für ${type} über mehrere Memory-Einträge erkannt`
      });
    }
  }
  return {
    entitySchemaVersion: ENTITY_SCHEMA_VERSION,
    relationSchemaVersion: RELATION_SCHEMA_VERSION,
    graphRuntimeVersion: GRAPH_RUNTIME_VERSION,
    entities: dedupeByKey(entities, (item) => item.entityId),
    resolvedEntities: dedupeByKey(resolvedEntities, (item) => item.canonicalEntityId),
    relations: dedupeByKey(relations, (item) => item.relationId),
    conflicts: dedupeByKey(conflicts.concat(aggregateConflicts), (item) => `${item.type}:${(item.values||[]).join('|')}`)
  };
}

function buildGraph(items = []) {
  const schema = summarizeSchema(items);
  const nodes = [];
  const edges = [];
  for (const entity of schema.resolvedEntities) {
    nodes.push({
      id: entity.canonicalEntityId,
      kind: 'entity',
      type: entity.type,
      label: entity.canonicalValue,
      confidence: entity.confidence,
      aliases: entity.aliases,
      sourceCount: entity.sourceCount
    });
  }
  for (const relation of schema.relations) {
    edges.push({
      id: relation.relationId,
      type: relation.type,
      from: relation.subjectId,
      to: relation.objectId,
      label: relation.objectValue,
      relevance: relation.relevance,
      timestamp: relation.timestamp
    });
  }
  return {
    version: GRAPH_RUNTIME_VERSION,
    nodes,
    edges,
    conflicts: schema.conflicts,
    stats: {
      nodeCount: nodes.length,
      edgeCount: edges.length,
      conflictCount: schema.conflicts.length
    }
  };
}

function retrieve(items = [], query = '', options = {}) {
  const limit = Math.max(1, Number(options.limit || 10));
  const scored = items
    .map((item) => {
      const details = scoreRetrieval(item, query);
      return { item, retrievalScore: details.score, explanation: details.reasons, confidence: details.confidence };
    })
    .filter((row) => row.retrievalScore >= RETRIEVAL_THRESHOLD)
    .sort((a, b) => b.retrievalScore - a.retrievalScore)
    .slice(0, limit)
    .map((row) => ({
      memoryId: row.item.memoryId,
      userId: row.item.userId,
      category: row.item.category,
      text: row.item.text,
      metadata: row.item.metadata || {},
      semantic: row.item.semantic,
      retrievalScore: row.retrievalScore,
      retrievalConfidence: row.confidence,
      retrievalExplanation: row.explanation,
      provenance: row.item.semantic?.provenance || buildProvenance(row.item)
    }));

  return {
    version: RETRIEVAL_API_VERSION,
    query: asString(query),
    total: scored.length,
    items: scored,
    schema: summarizeSchema(scored)
  };
}

module.exports = {
  ENTITY_SCHEMA_VERSION,
  RELATION_SCHEMA_VERSION,
  RETRIEVAL_API_VERSION,
  GRAPH_RUNTIME_VERSION,
  annotateItem,
  buildConflictSet,
  buildGraph,
  buildProvenance,
  detectOutcomeMarkers,
  extractEntities,
  extractRelations,
  resolveEntities,
  retrieve,
  summarizeSchema
};
