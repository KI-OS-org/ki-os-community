/**
 * KI-OS Orbit Control — Packs Adapter
 * Copyright (c) Ingo Schaffer
 *
 * Zweck:
 * Lädt Pack-Registry, Installationen und Historie.
 *
 * Status:
 * LIVE
 */
import { orbitFetch } from "../core/orbit-fetch";

export const packsAdapter = {
  listPacks: async () => orbitFetch("/api/packs/registry").then((r) => r.data),
  install: async (packId: string, tenantId: string) =>
    orbitFetch("/api/packs/install", { method: "POST", body: JSON.stringify({ packId, tenantId }) }).then((r) => r.data),
  history: async () => orbitFetch("/api/packs/history").then((r) => r.data),
};
