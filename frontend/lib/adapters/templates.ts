/**
 * KI-OS Orbit Control — Templates Adapter
 * Copyright (c) Ingo Schaffer
 *
 * Zweck:
 * Lädt No-Code-Templates und startet Template-basierte Aktionen.
 *
 * Status:
 * LIVE
 */
import { orbitFetch } from "../core/orbit-fetch";

export async function listTemplates() {
  return orbitFetch("/api/templates/list").then((r) => r.data);
}

export async function startTemplate(templateId: string) {
  return orbitFetch("/api/templates/start", {
    method: "POST",
    body: JSON.stringify({ templateId }),
  }).then((r) => r.data);
}
