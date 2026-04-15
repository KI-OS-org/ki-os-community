/**
 * KI-OS Orbit Control — Connector Fabric & MCP Adapter
 * Copyright (c) Ingo Schaffer
 *
 * Zweck:
 * Lädt Connector-Registry, Detaildaten, Test-Invoke, MCP-Manifest
 * und Capability-Auflösungen.
 *
 * Status:
 * LIVE
 */
import { orbitFetch } from "../core/orbit-fetch";

export async function connectorRegistry() {
  return orbitFetch("/api/connectors/registry").then((r) => r.data);
}
export async function connectorDetail(id = "sap-orders") {
  return orbitFetch(`/api/connectors/detail?id=${encodeURIComponent(id)}`).then((r) => r.data);
}
export async function connectorTrustLevels() {
  return orbitFetch("/api/connectors/registry").then((r) => ({ mode: "LIVE", source: "next-api", items: r.data }));
}
export async function connectorCapabilityResolver() {
  return orbitFetch("/api/mcp/capabilities").then((r) => r.data);
}
export async function testInvoke(connectorId = "sap-orders") {
  return orbitFetch("/api/connectors/test-invoke", { method: "POST", body: JSON.stringify({ connectorId }) }).then((r) => r.data);
}
export async function mcpManifestPreview() {
  return orbitFetch("/api/mcp/manifest").then((r) => r.data);
}
export async function fileFabricSummary() {
  return orbitFetch("/api/file-fabric").then((r) => r.data);
}
