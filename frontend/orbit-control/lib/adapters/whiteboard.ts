/**
 * KI-OS Orbit Control — Whiteboard Adapter
 * Copyright (c) Ingo Schaffer
 *
 * Zweck:
 * Lädt Board- und Shared-State für den kollaborativen Whiteboard-Bereich.
 *
 * Status:
 * LIVE
 */
import { orbitFetch } from "../core/orbit-fetch";

export async function getWhiteboardState() {
  const [board, shared] = await Promise.all([
    orbitFetch("/api/whiteboard/board").then((r) => r.data),
    orbitFetch("/api/whiteboard/shared").then((r) => r.data),
  ]);
  return { mode: "LIVE", board, shared };
}
