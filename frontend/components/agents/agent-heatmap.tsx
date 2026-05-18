interface CategoryStats {
  total: number; active: number; paused: number; idle: number; error: number;
}
interface Stats {
  total: number; active: number; paused: number; idle: number; error: number;
  byCategory: Record<string, CategoryStats>;
  categories: string[];
}

const CAT_COLORS: Record<string, string> = {
  Marketing:  "rgba(251,146,60,0.15)",
  Sales:      "rgba(34,197,94,0.12)",
  IT:         "rgba(90,196,255,0.12)",
  Finance:    "rgba(168,85,247,0.12)",
  Operations: "rgba(234,179,8,0.12)",
  Admin:      "rgba(148,163,184,0.10)",
};
const CAT_BORDER: Record<string, string> = {
  Marketing:  "rgba(251,146,60,0.3)",
  Sales:      "rgba(34,197,94,0.3)",
  IT:         "rgba(90,196,255,0.3)",
  Finance:    "rgba(168,85,247,0.3)",
  Operations: "rgba(234,179,8,0.3)",
  Admin:      "rgba(148,163,184,0.2)",
};
const CAT_TEXT: Record<string, string> = {
  Marketing:  "#fb923c", Sales: "#22c55e", IT: "#5ac4ff",
  Finance:    "#a855f7", Operations: "#eab308", Admin: "#94a3b8",
};

export function AgentHeatmap({ stats }: { stats: Stats | null }) {
  if (!stats) {
    return (
      <div className="rounded-[32px] border border-white/10 bg-black/20 p-5 backdrop-blur">
        <p className="text-sm text-[var(--muted-foreground)]">Stats nicht verfügbar — Backend offline?</p>
      </div>
    );
  }

  const categories = stats.categories || Object.keys(stats.byCategory);

  return (
    <section className="rounded-[32px] border border-white/10 bg-black/20 p-5 backdrop-blur">
      {/* Gesamt-Zahlen */}
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Gesamt", value: stats.total, color: "text-white" },
          { label: "Aktiv",  value: stats.active, color: "text-emerald-400" },
          { label: "Pausiert", value: stats.paused, color: "text-yellow-400" },
          { label: "Fehler", value: stats.error, color: "text-red-400" },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-[20px] border border-white/8 bg-white/4 px-4 py-3 text-center">
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
            <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">{label}</p>
          </div>
        ))}
      </div>

      {/* Kategorie-Heatmap */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {categories.map((cat) => {
          const c: CategoryStats = stats.byCategory[cat] ?? { total: 0, active: 0, paused: 0, idle: 0, error: 0 };
          return (
            <div
              key={cat}
              className="rounded-[20px] border p-4"
              style={{ background: CAT_COLORS[cat] ?? "rgba(255,255,255,0.04)", borderColor: CAT_BORDER[cat] ?? "rgba(255,255,255,0.1)" }}
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold" style={{ color: CAT_TEXT[cat] ?? "#fff" }}>{cat}</p>
                <p className="text-lg font-bold text-white">{c.total}</p>
              </div>
              <div className="mt-2 flex items-center gap-3 text-xs text-[var(--muted-foreground)]">
                {c.active > 0  && <span className="text-emerald-400">{c.active} aktiv</span>}
                {c.paused > 0  && <span className="text-yellow-400">{c.paused} pausiert</span>}
                {c.error > 0   && <span className="text-red-400">{c.error} Fehler</span>}
                {c.total === 0 && <span>Keine Agents</span>}
              </div>
              {/* Mini-Balken */}
              {c.total > 0 && (
                <div className="mt-3 flex h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                  {c.active > 0 && <div className="bg-emerald-400" style={{ width: `${(c.active / c.total) * 100}%` }} />}
                  {c.paused > 0 && <div className="bg-yellow-400" style={{ width: `${(c.paused / c.total) * 100}%` }} />}
                  {c.error > 0  && <div className="bg-red-400"    style={{ width: `${(c.error  / c.total) * 100}%` }} />}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
