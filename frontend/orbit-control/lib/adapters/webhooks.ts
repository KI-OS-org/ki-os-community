/**
 * KI-OS Orbit Control — Webhooks & Trigger Adapter
 * Calls the real KI-OS backend directly via orbitFetch.
 */
import { orbitFetch } from "../core/orbit-fetch";

export async function getWebhookStudioData() {
  const [uiConfig, policies, governance] = await Promise.all([
    orbitFetch("/ui/config").then((r) => r.data),
    orbitFetch("/governance/policies").then((r) => r.data),
    orbitFetch("/governance/registry").then((r) => r.data),
  ]);
  return { mode: "LIVE", uiConfig, policies, governance };
}

export const webhooksAdapter = {
  getStudioData:    getWebhookStudioData,
  getUiConfig:      async () => orbitFetch("/ui/config").then((r) => r.data),
  getPolicies:      async () => orbitFetch("/governance/policies").then((r) => r.data),
  testWebhook:      async (id: string, data?: unknown) =>
    orbitFetch("/admin/automation/webhook/test", { method: "POST", body: JSON.stringify({ id, data }) }).then((r) => r.data),
  saveWebhook:      async (config: unknown) =>
    orbitFetch("/admin/automation/webhook", { method: "POST", body: JSON.stringify(config) }).then((r) => r.data),
  listWebhooks:     async () => orbitFetch("/admin/automation/webhooks").then((r) => r.data),
  sendInbound:      async (payload: unknown) =>
    orbitFetch("/automation/webhook", { method: "POST", body: JSON.stringify(payload) }).then((r) => r.data),
};
