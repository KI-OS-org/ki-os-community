import { ProviderDashboardShell } from "@/components/providers/provider-dashboard-shell";
import { orbitFetch }             from "@/lib/core/orbit-fetch";

export default async function ProvidersPage() {
  const [live, decisions, models, scorecards] = await Promise.allSettled([
    orbitFetch("/ui/providers/live").then((r) => r.data),
    orbitFetch("/routing/decisions?limit=20").then((r) => r.data),
    orbitFetch("/ui/models").then((r) => r.data),
    orbitFetch("/routing/scorecards?limit=10").then((r) => r.data),
  ]);

  return (
    <ProviderDashboardShell
      live={live.status === "fulfilled"             ? live.value       as Record<string,unknown> : null}
      decisions={decisions.status === "fulfilled"   ? decisions.value  as Record<string,unknown> : null}
      models={models.status === "fulfilled"         ? models.value     as Record<string,unknown> : null}
      scorecards={scorecards.status === "fulfilled" ? scorecards.value as Record<string,unknown> : null}
    />
  );
}
