/**
 * KI-OS Orbit Control — Files & Memory Adapter
 * Copyright (c) Ingo Schaffer
 *
 * Zweck:
 * Bündelt Dateiansicht, Memory-Retrieval und Graph-Daten für UI-Bereiche,
 * die Dokumente, Memory-Hits und semantische Verknüpfungen zeigen.
 *
 * Verantwortung:
 * - lädt File-Snapshot
 * - lädt Memory-Hits
 * - liefert Upload-Metadaten für lokale Dateiauswahl
 *
 * Status:
 * LIVE
 */
import { orbitFetch } from "../core/orbit-fetch";

export type OrbitFile = Record<string, unknown>;
export type MemoryHit = Record<string, unknown>;
export type MemoryGraphData = Record<string, unknown>;

export const demoFiles: OrbitFile[] = [];
export const demoMemoryHits: MemoryHit[] = [];
export const demoMemoryGraph: MemoryGraphData = { nodes: [], edges: [] };

export async function getFilesSnapshot() {
  const [files, memory] = await Promise.all([
    orbitFetch("/api/files").then((r) => r.data),
    orbitFetch("/api/memory/retrieve").then((r) => r.data),
  ]);

  return {
    mode: "LIVE",
    files,
    memory,
  };
}

export function createOrbitFilesFromSelection(files: File[]) {
  return files.map((file, index) => ({
    id: `upload-${index}-${file.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    name: file.name,
    typeLabel: file.type || "Datei",
    sizeLabel: `${file.size} B`,
    source: "local-upload",
    status: "ready",
    preview: "Lokaler Upload, serverseitige Persistenz folgt über echten Upload-Endpunkt.",
    origin: "Upload · Benutzer",
    tags: ["Upload"],
    relevance: 0,
    memorySaved: false,
    lastAccessed: new Date().toISOString(),
  }));
}
