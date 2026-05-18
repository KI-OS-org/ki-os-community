import { SolutionHubShell } from "@/components/solutions/solution-hub-shell";
import { orbitFetch }       from "@/lib/core/orbit-fetch";

export default async function SolutionsPage() {
  const [economicRes, federationRes, packsRes] = await Promise.allSettled([
    orbitFetch("/economic"),
    orbitFetch("/federation"),
    orbitFetch("/packs"),
  ]);

  return (
    <SolutionHubShell
      economic={economicRes.status === "fulfilled" && economicRes.value.ok ? economicRes.value.data : null}
      federation={federationRes.status === "fulfilled" && federationRes.value.ok ? federationRes.value.data : null}
      packs={packsRes.status === "fulfilled" && packsRes.value.ok ? packsRes.value.data as unknown[] : null}
    />
  );
}
