"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle, Moon, Archive, Wrench, CheckCircle, ChevronRight,
  RefreshCw, Search, SlidersHorizontal,
} from "lucide-react";

interface Incident {
  id: string;
  level: 1 | 2 | 3;
  source: string;
  error: string;
  status: string;
  occurrences: number;
  confidence: number | null;
  createdAt: string;
  suggestedFix: string | null;
  affectedFile: string | null;
}

const LEVEL_CONFIG = {
  1: { label: "L1 Kritisch",  icon: AlertTriangle, color: "text-red-400",    bg: "bg-red-500/10    border-red-500/30",    dot: "bg-red-400" },
  2: { label: "L2 Night-Slot",icon: Moon,          color: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/30", dot: "bg-yellow-400" },
  3: { label: "L3 Backlog",   icon: Archive,       color: "text-slate-400",  bg: "bg-white/5       border-white/10",       dot: "bg-slate-400" },
} as const;

const STATUS_LABEL: Record<string, string> = {
  open:       "Offen",
  analyzing:  "Wird analysiert…",
  fix_ready:  "Fix bereit",
  approved:   "Genehmigt",
  applied:    "Angewendet",
  resolved:   "Gelöst",
  deferred:   "Zurückgestellt",
};

const STATUS_COLOR: Record<string, string> = {
  open:       "text-white/60",
  analyzing:  "text-yellow-300",
  fix_ready:  "text-emerald-300",
  approved:   "text-emerald-400",
  applied:    "text-emerald-400",
  resolved:   "text-white/40",
  deferred:   "text-white/40",
};

function fmt(iso: string) {
  return new Date(iso).toLocaleString("de-DE", {
    day: "2-digit", month: "2-digit", year: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}

export function IncidentList({ incidents: initial }: { incidents: unknown[] }) {
  const router = useRouter();
  const [incidents] = useState<Incident[]>(initial as Incident[]);
  const [search, setSearch]       = useState("");
  const [filterLevel, setFilterLevel]   = useState("Alle");
  const [filterStatus, setFilterStatus] = useState("Alle");
  const [pending, startTransition] = useTransition();

  const filtered = incidents.filter(i => {
    const matchLevel  = filterLevel  === "Alle" || i.level === Number(filterLevel);
    const matchStatus = filterStatus === "Alle" || i.status === filterStatus;
    const matchSearch = !search ||
      (i.error  || "").toLowerCase().includes(search.toLowerCase()) ||
      (i.source || "").toLowerCase().includes(search.toLowerCase());
    return matchLevel && matchStatus && matchSearch;
  });

  async function triggerAnalysis(id: string, e: React.MouseEvent) {
    e.preventDefault();
    startTransition(async () => {
      await fetch(`/api/selfrepair/${id}/analyze`, { method: "POST" });
      router.refresh();
    });
  }

  return (
    <section className="rounded-[32px] border border-white/10 bg-black/20 backdrop-blur">
      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-3 border-b border-white/8 p-4">
        <div className="flex flex-1 items-center gap-2 rounded-[18px] border border-white/10 bg-white/5 px-3 py-2">
          <Search className="size-3.5 shrink-0 text-[var(--muted-foreground)]" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Fehler, Service..."
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--muted-foreground)]"
          />
        </div>
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="size-3.5 text-[var(--muted-foreground)]" />
          <select
            value={filterLevel}
            onChange={e => setFilterLevel(e.target.value)}
            className="rounded-[14px] border border-white/10 bg-black/40 px-3 py-1.5 text-sm text-white outline-none"
          >
            {["Alle", "1", "2", "3"].map(v => (
              <option key={v} value={v}>{v === "Alle" ? "Alle Level" : `L${v} ${v === "1" ? "Kritisch" : v === "2" ? "Night-Slot" : "Backlog"}`}</option>
            ))}
          </select>
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="rounded-[14px] border border-white/10 bg-black/40 px-3 py-1.5 text-sm text-white outline-none"
          >
            <option value="Alle">Alle Status</option>
            {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <p className="text-xs text-[var(--muted-foreground)]">{filtered.length} Incident{filtered.length !== 1 ? "s" : ""}</p>
      </div>

      {/* List */}
      <div className="divide-y divide-white/5">
        {filtered.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <CheckCircle className="size-10 opacity-20" />
            <p className="text-sm text-[var(--muted-foreground)]">
              {incidents.length === 0 ? "Keine Incidents — System läuft stabil." : "Keine Incidents gefunden."}
            </p>
          </div>
        )}

        {filtered.map(incident => {
          const lvl  = LEVEL_CONFIG[incident.level] ?? LEVEL_CONFIG[3];
          const Icon = lvl.icon;
          return (
            <Link
              key={incident.id}
              href={`/repair/${incident.id}`}
              className="group flex items-center gap-4 px-5 py-4 transition hover:bg-white/3"
            >
              {/* Level badge */}
              <div className={`flex shrink-0 items-center gap-1.5 rounded-[12px] border px-2.5 py-1.5 ${lvl.bg}`}>
                <Icon className={`size-3.5 ${lvl.color}`} />
                <span className={`text-[11px] font-medium ${lvl.color}`}>{lvl.label}</span>
              </div>

              {/* Info */}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-white">
                  {(incident.error || "Unbekannter Fehler").slice(0, 80)}
                </p>
                <p className="mt-0.5 truncate text-xs text-[var(--muted-foreground)]">
                  {incident.source || "–"} · {fmt(incident.createdAt)}
                  {incident.occurrences > 1 && ` · ${incident.occurrences}× aufgetreten`}
                </p>
              </div>

              {/* Status + Actions */}
              <div className="flex shrink-0 items-center gap-2">
                <span className={`text-xs ${STATUS_COLOR[incident.status] ?? "text-white/60"}`}>
                  {STATUS_LABEL[incident.status] ?? incident.status}
                </span>
                {(incident.status === "open" || incident.status === "fix_ready") && (
                  <button
                    type="button"
                    onClick={e => triggerAnalysis(incident.id, e)}
                    disabled={pending}
                    className="rounded-[10px] border border-white/10 bg-white/5 p-1.5 transition hover:bg-white/10 disabled:opacity-50"
                    title="AI-Analyse starten"
                  >
                    <RefreshCw className="size-3.5 text-[var(--accent)]" />
                  </button>
                )}
                {incident.confidence !== null && (
                  <span className="rounded-full bg-white/8 px-2 py-0.5 text-[10px] text-[var(--muted-foreground)]">
                    {Math.round((incident.confidence ?? 0) * 100)}% Konfidenz
                  </span>
                )}
                <ChevronRight className="size-4 text-[var(--muted-foreground)] transition group-hover:text-white" />
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
