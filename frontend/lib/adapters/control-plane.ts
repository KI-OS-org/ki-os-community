import { orbitFetch } from "../core/orbit-fetch";
/* eslint-disable @typescript-eslint/no-explicit-any */
export async function getControlPlaneSnapshot() {
  const [health, incidents, security, traces, telemetry, visible, providers, dag, backends] = await Promise.all([
    orbitFetch("/health").then(r => r.data),
    orbitFetch("/ui/incidents").then(r => r.data),
    orbitFetch("/ui/security").then(r => r.data),
    orbitFetch("/ui/traces").then(r => r.data),
    orbitFetch("/ui/telemetry").then(r => r.data),
    orbitFetch("/ui/control-plane/visible").then(r => r.data),
    orbitFetch("/ui/providers/live").then(r => r.data),
    orbitFetch("/ui/dag/live").then(r => r.data),
    orbitFetch("/state/backends").then(r => r.data),
  ]);
  const v = visible as any;
  const t = telemetry as any;
  return {
    health, incidents, security, traces,
    dlq: v?.executions?.failed ?? v?.executions ?? null,
    recovery: t?.observability ?? t ?? null,
    supervisor: v?.supervisor ?? null,
    visible, providers, dag, backends,
  };
}
