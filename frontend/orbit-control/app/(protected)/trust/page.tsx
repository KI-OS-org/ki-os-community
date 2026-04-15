import { TrustCenterShell } from "@/components/trust/trust-center-shell";
import { orbitFetch }       from "@/lib/core/orbit-fetch";

export default async function TrustPage() {
  const [audit, policies, approvals, security] = await Promise.allSettled([
    orbitFetch("/ui/audit?limit=50").then((r) => r.data),
    orbitFetch("/governance/policies?limit=50").then((r) => r.data),
    orbitFetch("/governance/approvals?limit=20").then((r) => r.data),
    orbitFetch("/ui/security/health").then((r) => r.data),
  ]);

  return (
    <TrustCenterShell
      audit={audit.status         === "fulfilled" ? audit.value     as Record<string,unknown> : null}
      policies={policies.status   === "fulfilled" ? policies.value  as Record<string,unknown> : null}
      approvals={approvals.status === "fulfilled" ? approvals.value as Record<string,unknown> : null}
      security={security.status   === "fulfilled" ? security.value  as Record<string,unknown> : null}
    />
  );
}
