/**
 * KI-OS Orbit Control — Explain & Trust Adapter
 * Copyright (c) Ingo Schaffer
 *
 * Zweck:
 * Dieser Adapter lädt Explainability- und Trust-Daten für Frontend-Sichten,
 * die Entscheidungen, Governance-Hintergründe und Vertrauensindikatoren
 * transparent machen sollen.
 *
 * Verantwortung:
 * - lädt Explain-Snapshots
 * - lädt Trust-Lens-Daten
 * - lädt Drilldowns für konkrete Runs
 *
 * Aufrufer:
 * Explain-/Trust-Screens im Orbit-Control-Frontend.
 *
 * Status:
 * LIVE
 */
import { orbitFetch } from "../core/orbit-fetch";

export const explainAdapter = {
  async getExplainSnapshot() {
    return orbitFetch("/api/explain").then((r) => r.data);
  },
  async getTrustLens() {
    return orbitFetch("/api/trust").then((r) => r.data);
  },
  async getDecisionDrilldown(runId: string) {
    return orbitFetch(`/api/explain?runId=${encodeURIComponent(runId)}`).then((r) => r.data);
  },
};
