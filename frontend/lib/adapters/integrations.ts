/**
 * KI-OS Orbit Control — Integrations Hub Adapter
 * Calls the real KI-OS backend directly via orbitFetch.
 */
import { orbitFetch } from "../core/orbit-fetch";

export async function getIntegrationsHubSnapshot() {
  const [connectors, health, capabilities] = await Promise.all([
    orbitFetch("/connectors").then((r) => r.data),
    orbitFetch("/connectors/health").then((r) => r.data),
    orbitFetch("/connectors/capabilities").then((r) => r.data),
  ]);
  return { mode: "LIVE", connectors, health, capabilities };
}

export const integrationsAdapter = {
  getSnapshot:       getIntegrationsHubSnapshot,
  getConnectors:     async () => orbitFetch("/connectors").then((r) => r.data),
  getHealth:         async () => orbitFetch("/connectors/health").then((r) => r.data),
  getCapabilities:   async () => orbitFetch("/connectors/capabilities").then((r) => r.data),
  getConnector:      async (id: string) => orbitFetch(`/connectors/${id}`).then((r) => r.data),
  invokeConnector:   async (connectorId: string, capability: string, payload: unknown) =>
    orbitFetch("/connectors/invoke", { method: "POST", body: JSON.stringify({ connectorId, capability, payload }) }).then((r) => r.data),
  registerConnector: async (def: unknown) =>
    orbitFetch("/connectors/register", { method: "POST", body: JSON.stringify(def) }).then((r) => r.data),
  getMcpManifest:    async () => orbitFetch("/mcp/manifest").then((r) => r.data),
  getMcpCapabilities: async () => orbitFetch("/mcp/capabilities").then((r) => r.data),
};
