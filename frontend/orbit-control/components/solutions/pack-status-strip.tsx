interface Pack {
  id: string;
  name: string;
  status: string;
  version?: string;
}

interface Props {
  packs?: Pack[];
}

const SAMPLE_PACKS: Pack[] = [
  { id: "pk-retail", name: "Retail Pack", status: "active", version: "2.1.0" },
  { id: "pk-executive", name: "Executive Pack", status: "active", version: "1.4.2" },
  { id: "pk-ops", name: "Ops Intelligence", status: "beta", version: "0.9.1" },
  { id: "pk-economic", name: "Economic Studio", status: "active", version: "1.0.5" },
  { id: "pk-federation", name: "Federation Layer", status: "active", version: "1.2.0" },
  { id: "pk-govai", name: "Gov AI Pack", status: "coming soon" },
];

function dotClass(status: string): string {
  if (status === "active") return "status-dot green";
  if (status === "beta") return "status-dot blue";
  if (status === "error") return "status-dot red";
  return "status-dot yellow";
}

function badgeClass(status: string): string {
  if (status === "active") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-400";
  if (status === "beta") return "border-[var(--accent)]/30 bg-[rgba(90,196,255,0.1)] text-[var(--accent)]";
  if (status === "coming soon") return "border-white/10 bg-white/5 text-[var(--muted-foreground)]";
  return "border-white/10 bg-white/5 text-[var(--muted-foreground)]";
}

export function PackStatusStrip({ packs }: Props) {
  const list = packs && packs.length > 0 ? packs : SAMPLE_PACKS;

  return (
    <div data-testid="pack-status-strip" className="overflow-x-auto pb-1">
      <div className="flex gap-3 min-w-max">
        {list.map((pack) => (
          <div
            key={pack.id}
            className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-black/20 px-3 py-2 hover:border-white/20 transition-colors"
          >
            <span className={dotClass(pack.status)} />
            <span className="text-xs font-medium text-white whitespace-nowrap">{pack.name}</span>
            {pack.version && (
              <span className="text-[10px] text-[var(--muted-foreground)]">v{pack.version}</span>
            )}
            <span
              className={`rounded-full border px-2 py-0.5 text-[10px] font-medium capitalize whitespace-nowrap ${badgeClass(pack.status)}`}
            >
              {pack.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
