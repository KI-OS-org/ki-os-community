import { JobsDashboardShell } from "@/components/jobs/jobs-dashboard-shell";
import { orbitFetch }         from "@/lib/core/orbit-fetch";

export default async function JobsPage() {
  const [runs, events] = await Promise.allSettled([
    orbitFetch("/ui/runs?limit=50").then((r) => r.data),
    orbitFetch("/ui/events?limit=50").then((r) => r.data),
  ]);

  return (
    <JobsDashboardShell
      runs={runs.status     === "fulfilled" ? runs.value   as Record<string,unknown> : null}
      events={events.status === "fulfilled" ? events.value as Record<string,unknown> : null}
    />
  );
}
