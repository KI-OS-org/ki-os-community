/**
 * KI-OS Orbit Control — Solutions Adapter
 * Copyright (c) Ingo Schaffer
 *
 * Zweck:
 * Lädt sichtbare Domänenlösungen und Pack-Status für rollenbezogene
 * Produktflächen.
 *
 * Status:
 * LIVE
 */
import { orbitFetch } from "../core/orbit-fetch";

export async function getVisibleSolutions(role = "operator") {
  return orbitFetch(`/api/solutions/domains?role=${encodeURIComponent(role)}`).then((r) => r.data);
}

export async function getPackStatuses() {
  return orbitFetch("/api/solutions/packs").then((r) => r.data);
}
