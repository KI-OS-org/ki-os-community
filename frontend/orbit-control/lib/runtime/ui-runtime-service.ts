// @ts-nocheck
/**
 * KI-OS Orbit Control — UI Runtime Service
 * Copyright (c) Ingo Schaffer
 *
 * Zweck:
 * Gemeinsame L2-Live-light Service-Schicht für Run-Trace-Erzeugung,
 * Explain-/Trust-Ableitung sowie Files-/Memory-Retrieval.
 *
 * Status:
 * LIVE-LIGHT
 */
import {
  appendUiRuntimeEvent,
  findUiRuntimeEntityById,
  loadUiRuntimeState,
  resetUiRuntimeState,
  saveUiRuntimeState,
  updateUiRuntimeState
} from "./ui-runtime-store";

function makeId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createRuntimeRun(payload = {}) {
  const now = new Date().toISOString();
  const runId = makeId("run");
  const tenant = payload.tenant || "demo-tenant";
  const workspaceId = payload.workspaceId || "ws-retail";
  const sourceName = payload.sourceName || "Runtime Generated Analysis";
  const summary = payload.summary || "Runtime generated decision summary";
  const tags = payload.tags || ["runtime", "analysis"];
  const fileName = payload.fileName || "runtime-note.md";

  const trace = {
    runId,
    tenant,
    workspaceId,
    createdAt: now,
    model: payload.model || "gpt-5.x",
    route: payload.route || "retail-domain",
    routingReason: payload.routingReason || "runtime-run + default policy chain",
    policyChecks: payload.policyChecks || [
      { policy: "budget-guard", result: "pass" },
      { policy: "privacy-guard", result: "pass" }
    ],
    toolCalls: payload.toolCalls || [{ tool: "workspace.chat", status: "ok" }],
    confidence: payload.confidence ?? 0.81,
    status: payload.status || "completed",
    summary
  };

  const memoryId = makeId("mem");
  const memoryItem = {
    memoryId,
    tenant,
    scope: payload.scope || "workspace",
    workspaceId,
    sourceType: payload.sourceType || "run-summary",
    sourceName,
    tags,
    summary,
    reason: payload.reason || "Stored from runtime live-light flow",
    linkedRunId: runId,
    createdAt: now
  };

  const fileId = makeId("file");
  const fileEntry = {
    fileId,
    tenant,
    name: fileName,
    type: payload.fileType || "md",
    category: payload.fileCategory || "generated",
    linkedRunId: runId,
    linkedMemoryIds: [memoryId],
    createdAt: now
  };

  updateUiRuntimeState((state) => {
    state.runs.traces.push(trace);
    state.memory.items.push(memoryItem);
    state.files.entries.push(fileEntry);
    return state;
  });

  return { runId, memoryId, fileId, trace, memoryItem, fileEntry };
}

export function getRunTrace(runId) {
  return findUiRuntimeEntityById("runs", "traces", "runId", runId);
}

export function buildExplainResponse(runId) {
  const trace = getRunTrace(runId);
  if (!trace) return null;
  return {
    ok: true,
    mode: "LIVE",
    runId: trace.runId,
    model: trace.model,
    route: trace.route,
    routingReason: trace.routingReason,
    policyChecks: trace.policyChecks,
    toolCalls: trace.toolCalls,
    confidence: trace.confidence,
    summary: trace.summary,
    status: trace.status
  };
}

export function buildTrustResponse(runId) {
  const trace = getRunTrace(runId);
  if (!trace) return null;
  const hasFail = Array.isArray(trace.policyChecks) && trace.policyChecks.some((entry) => entry.result !== "pass");
  const trustStatus = hasFail ? "review" : trace.confidence >= 0.8 ? "green" : "review";
  return {
    ok: true,
    mode: "LIVE",
    runId: trace.runId,
    trustStatus,
    policyState: hasFail ? "restricted" : "enforced",
    safetyFlags: hasFail ? ["policy-review-required"] : [],
    confidence: trace.confidence,
    policyChecks: trace.policyChecks
  };
}

export function listFiles(tenant) {
  const state = loadUiRuntimeState();
  return tenant ? state.files.entries.filter((entry) => entry.tenant === tenant) : state.files.entries;
}

export function retrieveMemory(query = "", tenant = "", workspaceId = "") {
  const state = loadUiRuntimeState();
  const q = String(query || "").toLowerCase().trim();
  return state.memory.items.filter((item) => {
    if (tenant && item.tenant !== tenant) return false;
    if (workspaceId && item.workspaceId !== workspaceId) return false;
    if (!q) return true;
    const haystack = [item.sourceName, item.summary, item.reason, ...(item.tags || [])].join(" ").toLowerCase();
    return haystack.includes(q);
  });
}

export const uiRuntimeService = {
  load: loadUiRuntimeState,
  save: saveUiRuntimeState,
  reset: resetUiRuntimeState,
  update: updateUiRuntimeState,
  appendEvent: appendUiRuntimeEvent,
  findById: findUiRuntimeEntityById,
  createRuntimeRun,
  getRunTrace,
  buildExplainResponse,
  buildTrustResponse,
  listFiles,
  retrieveMemory
};
