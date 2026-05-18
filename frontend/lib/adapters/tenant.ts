/**
 * KI-OS Orbit Control — Tenant Admin Adapter
 * Copyright (c) Ingo Schaffer
 *
 * Zweck:
 * Lädt Tenant-Übersichten, Detaildaten und Workspace-Erstellung
 * für die Admin-/Mandantenverwaltung.
 *
 * Status:
 * LIVE
 */
import { orbitFetch } from "../core/orbit-fetch";

export const tenantAdapter = {
  listTenants: async () => orbitFetch("/api/tenants/overview").then((r) => r.data),
  getTenant: async (tenantId: string) =>
    orbitFetch(`/api/tenants/detail?tenantId=${encodeURIComponent(tenantId)}`).then((r) => r.data),
  createWorkspace: async (tenantId: string, name: string) =>
    orbitFetch("/api/tenants/workspaces", {
      method: "POST",
      body: JSON.stringify({ tenantId, name }),
    }).then((r) => r.data),
};
