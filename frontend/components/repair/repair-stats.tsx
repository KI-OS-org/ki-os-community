"use client";

interface Stats {
  total: number; open: number;
  l1_open: number; l2_open: number; l3_open: number;
  fix_ready: number; resolved: number;
}

const CARDS = [
  { key: "l1_open",   label: "L1 Kritisch",    color: "border-red-500/30 bg-red-500/8 text-red-300",           dot: "bg-red-400" },
  { key: "l2_open",   label: "L2 Night-Slot",  color: "border-yellow-500/30 bg-yellow-500/8 text-yellow-300",  dot: "bg-yellow-400" },
  { key: "l3_open",   label: "L3 Backlog",     color: "border-white/10 bg-white/5 text-white/70",              dot: "bg-slate-400" },
  { key: "fix_ready", label: "Fix bereit",      color: "border-emerald-500/30 bg-emerald-500/8 text-emerald-300", dot: "bg-emerald-400" },
  { key: "resolved",  label: "Gelöst",          color: "border-white/10 bg-white/5 text-white/50",             dot: "bg-emerald-600" },
  { key: "total",     label: "Gesamt",          color: "border-white/10 bg-white/5 text-white/70",             dot: "bg-slate-500" },
] as const;

export function RepairStats({ stats }: { stats: Stats }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {CARDS.map(({ key, label, color, dot }) => (
        <div key={key} className={`rounded-[20px] border px-4 py-3 ${color}`}>
          <div className="flex items-center gap-1.5 mb-1">
            <span className={`size-2 rounded-full ${dot}`} />
            <p className="text-[10px] uppercase tracking-widest opacity-70">{label}</p>
          </div>
          <p className="text-2xl font-bold">{stats[key as keyof Stats] ?? 0}</p>
        </div>
      ))}
    </div>
  );
}
