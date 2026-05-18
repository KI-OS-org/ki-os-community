import { RunDetailShell } from "@/components/runs/run-detail-shell";
import { orbitFetch }     from "@/lib/core/orbit-fetch";
import { notFound }       from "next/navigation";

export default async function RunDetailPage({ params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;

  const [runRes, eventsRes] = await Promise.allSettled([
    orbitFetch(`/ui/tasks/${runId}`),
    orbitFetch("/ui/events?limit=100"),
  ]);

  const run = runRes.status === "fulfilled"
    ? (runRes.value.data as Record<string,unknown>)?.item ?? runRes.value.data
    : null;
  const evs = eventsRes.status === "fulfilled"
    ? (eventsRes.value.data as Record<string,unknown>)?.items ?? []
    : [];

  if (!run) return notFound();

  return (
    <RunDetailShell
      run={run as Record<string, unknown>}
      events={Array.isArray(evs) ? evs as Record<string, unknown>[] : []}
    />
  );
}
