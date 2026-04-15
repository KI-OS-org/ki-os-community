import { orbitFetch } from "@/lib/core/orbit-fetch";
import { ControlPlaneShell, ControlPlaneRefresher } from "@/components/control-plane/control-plane-shell";
import { GovernanceStudioPage } from "@/components/governance/governance-studio-shell";
import { Badge } from "@/components/ui/badge";

export default async function ControlPage() {
  const [healthResult, incidentsResult, supervisorResult, tracesResult, securityResult, metricsResult] =
    await Promise.allSettled([
      orbitFetch("/health"),
      orbitFetch("/ui/incidents"),
      orbitFetch("/ui/supervisor"),
      orbitFetch("/ui/traces?limit=20"),
      orbitFetch("/ui/security"),
      orbitFetch("/metrics"),
    ]);

  const health    = healthResult.status    === "fulfilled" ? healthResult.value.data    : null;
  const incidents = incidentsResult.status === "fulfilled" ? incidentsResult.value.data : null;
  const supervisor= supervisorResult.status=== "fulfilled" ? supervisorResult.value.data: null;
  const traces    = tracesResult.status    === "fulfilled" ? tracesResult.value.data    : null;
  const security  = securityResult.status  === "fulfilled" ? securityResult.value.data  : null;
  const metrics   = metricsResult.status   === "fulfilled" ? metricsResult.value.data   : null;

  const overallStatus = (health as { status?: string } | null)?.status || "unknown";

  return (
    <>
      <section className="rounded-[32px] border border-white/10 bg-black/20 p-5 backdrop-blur md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <Badge>Control Plane</Badge>
            <Badge className="text-cyan-200">Operator View</Badge>
            <Badge className={
              overallStatus === "healthy" || overallStatus === "ok"
                ? "text-emerald-200"
                : overallStatus === "degraded" ? "text-yellow-200" : "text-red-300"
            }>{overallStatus}</Badge>
          </div>
          <ControlPlaneRefresher intervalMs={15000} />
        </div>
        <h2 className="mt-4 text-3xl font-semibold tracking-tight">Control Plane</h2>
        <p className="mt-2 max-w-3xl text-sm text-[var(--muted-foreground)]">
          Real-time system health, incidents, distributed traces, supervisor mesh state
          and security posture. Auto-refreshes every 15 seconds.
        </p>
      </section>
      <ControlPlaneShell
        health={health} incidents={incidents} supervisor={supervisor}
        traces={traces} security={security} metrics={metrics}
      />
      <section className="rounded-[32px] border border-white/10 bg-black/20 backdrop-blur overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 border-b border-white/10 px-6 py-4">
          <Badge>Governance</Badge>
          <Badge className="text-cyan-200">Policies &amp; Approvals</Badge>
        </div>
        <GovernanceStudioPage />
      </section>
    </>
  );
}
