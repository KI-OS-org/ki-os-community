import { Package, Sparkles } from "lucide-react";
import { DomainEntryGrid } from "./domain-entry-grid";
import { PackStatusStrip } from "./pack-status-strip";

interface Pack {
  id: string;
  name: string;
  status: string;
  version?: string;
}

interface Props {
  packs?: unknown[];
  economic?: unknown;
  federation?: unknown;
}

const DOMAINS = [
  {
    id: "retail",
    label: "Retail",
    description: "Pricing, promotions, inventory intelligence and basket optimization for retail operations.",
    href: "/retail",
    status: "active",
    icon: "🛍️",
  },
  {
    id: "executive",
    label: "Executive",
    description: "Strategic KPI dashboard, decision logs and governance overview for leadership.",
    href: "/executive",
    status: "active",
    icon: "📊",
  },
  {
    id: "operations",
    label: "Operations",
    description: "Workflow automation, agent mesh monitoring and operational control plane.",
    href: "/control",
    status: "active",
    icon: "⚙️",
  },
  {
    id: "economic",
    label: "Economic",
    description: "Cost-outcome analysis, scoring profiles and strategic economic modeling.",
    href: "/economic-federation",
    status: "active",
    icon: "💹",
  },
  {
    id: "federation",
    label: "Federation",
    description: "Partner consent management, data federation signals and cross-org benchmarks.",
    href: "/economic-federation",
    status: "beta",
    icon: "🔗",
  },
  {
    id: "governance",
    label: "Governance",
    description: "Compliance framework, audit trails and AI governance policy enforcement.",
    href: "/governance",
    status: "beta",
    icon: "🛡️",
  },
];

function normalizePacks(raw: unknown[]): Pack[] {
  return raw.map((p: unknown) => {
    if (p && typeof p === "object" && !Array.isArray(p)) {
      return p as Pack;
    }
    return { id: String(Math.random()), name: "Unknown Pack", status: "unknown" };
  });
}

export function SolutionHubShell({ packs: rawPacks }: Props) {
  const packs = rawPacks ? normalizePacks(rawPacks) : undefined;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="rounded-[32px] border border-white/10 bg-black/20 backdrop-blur p-5 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-[var(--accent)]" />
            Solutions & Verticals
          </h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">
            Domain entry points, installed packs and role-specific views for KI-OS.
          </p>
        </div>
        <div className="flex gap-4 text-sm">
          <div className="text-center">
            <p className="text-xl font-bold text-[var(--accent)]">{DOMAINS.length}</p>
            <p className="text-xs text-[var(--muted-foreground)]">Domains</p>
          </div>
          <div className="text-center">
            <p className="text-xl font-bold text-white">{packs?.length ?? 6}</p>
            <p className="text-xs text-[var(--muted-foreground)]">Packs</p>
          </div>
        </div>
      </div>

      {/* Domain grid */}
      <div className="rounded-[32px] border border-white/10 bg-black/20 backdrop-blur p-5 space-y-4">
        <h2 className="text-sm font-semibold text-white">Domain Verticals</h2>
        <DomainEntryGrid domains={DOMAINS} />
      </div>

      {/* Pack status strip */}
      <div className="rounded-[32px] border border-white/10 bg-black/20 backdrop-blur p-5 space-y-4">
        <h2 className="text-sm font-semibold text-white flex items-center gap-2">
          <Package className="h-4 w-4 text-[var(--accent)]" />
          Installed Packs
        </h2>
        <PackStatusStrip packs={packs} />
      </div>
    </div>
  );
}
