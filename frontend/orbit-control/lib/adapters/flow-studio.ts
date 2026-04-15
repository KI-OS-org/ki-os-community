/**
 * KI-OS Orbit Control — Flow Studio Adapter
 * Copyright (c) Ingo Schaffer
 *
 * Zweck:
 * Lädt Flow-Templates, Starter-Templates, Test-Runs und gespeicherte Flows
 * für den visuellen Orchestrierungsbereich.
 *
 * Status:
 * LIVE
 */
import { orbitFetch } from "../core/orbit-fetch";

export async function getFlowTemplates() {
  return orbitFetch("/api/flows/templates").then((r) => r.data);
}

export async function getStarterTemplates() {
  return orbitFetch("/api/flows").then((r) => r.data);
}

export async function runFlowNodeTest(templateId: string) {
  return orbitFetch("/api/flows/test-run", {
    method: "POST",
    body: JSON.stringify({ templateId }),
  }).then((r) => r.data);
}

export async function loadFlow(id: string) {
  return orbitFetch(`/api/flows?id=${encodeURIComponent(id)}`).then((r) => r.data);
}

export async function saveFlow(payload: Record<string, unknown>) {
  return orbitFetch("/api/flows", {
    method: "POST",
    body: JSON.stringify(payload),
  }).then((r) => r.data);
}
