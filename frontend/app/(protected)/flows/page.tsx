import Link from "next/link";
import { orbitFetch } from "@/lib/core/orbit-fetch";
import { DagRegistryPanel, LiveExecutionPanel } from "@/components/flows/dag-registry-panel";
import { FlowStudioShell } from "@/components/flows/flow-studio-shell";
import { Badge } from "@/components/ui/badge";

export default async function FlowsPage() {
  const [dagResult, liveResult] = await Promise.allSettled([
    orbitFetch("/dag"),
    orbitFetch("/ui/dag/live"),
  ]);

  const dagRaw = dagResult.status === "fulfilled" ? dagResult.value.data : null;
  const liveRaw = liveResult.status === "fulfilled" ? liveResult.value.data : null;

  const dags: unknown[] = Array.isArray((dagRaw as { dags?: unknown[] })?.dags)
    ? (dagRaw as { dags: unknown[] }).dags
    : Array.isArray(dagRaw)
    ? (dagRaw as unknown[])
    : [];

  return (
    <>
      {/* Page header */}
      <section className="rounded-[32px] border border-white/10 bg-black/20 p-5 backdrop-blur md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <Badge>DAG Registry</Badge>
            <Badge className="text-cyan-200">Live Execution</Badge>
            <Badge className="text-emerald-200">Flow Studio</Badge>
          </div>
          <Link
            href="/flows/studio"
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[rgba(90,196,255,0.12)] border border-[rgba(90,196,255,0.25)] text-[#5ac4ff] text-sm font-medium hover:bg-[rgba(90,196,255,0.2)] transition-colors"
          >
            ✦ Visual DAG Studio
          </Link>
        </div>
        <h2 className="mt-3 text-xl font-semibold tracking-tight">Flows & Automatisierung</h2>
        <p className="mt-1 max-w-3xl text-sm text-[var(--muted-foreground)]">
          Design, register and execute agent DAGs. The registry shows all available
          flows — hit Execute to trigger a live run and see the result inline.
        </p>
      </section>

      <DagRegistryPanel dags={dags} />
      <LiveExecutionPanel live={liveRaw} />

      {/* Flow Studio editor */}
      <section className="rounded-[32px] border border-white/10 bg-black/20 p-5 backdrop-blur">
        <div className="mb-4 flex items-center gap-2">
          <Badge className="text-emerald-200">Flow Studio</Badge>
          <span className="text-sm text-[var(--muted-foreground)]">
            Low-code DAG editor mit Governance, Privacy und Testrun
          </span>
        </div>
        <FlowStudioShell />
      </section>
    </>
  );
}
