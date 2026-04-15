import { RunListShell } from "@/components/runs/run-list-shell";
import { orbitFetch }   from "@/lib/core/orbit-fetch";

export default async function RunsPage() {
  const { data } = await orbitFetch("/ui/runs?limit=50");
  const items = Array.isArray((data as Record<string,unknown>)?.items)
    ? (data as Record<string,unknown[]>).items
    : [];

  return <RunListShell initialRuns={items} />;
}
