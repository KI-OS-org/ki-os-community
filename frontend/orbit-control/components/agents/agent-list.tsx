"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bot, ChevronRight, Pause, Play, Search, SlidersHorizontal } from "lucide-react";

interface Agent {
  id: string; name: string; category: string; subCategory?: string;
  owner?: string; status: "active" | "paused" | "idle" | "error";
  description?: string; tags?: string[]; runCount?: number;
  errorCount?: number; lastRun?: string; createdAt: string;
}

const STATUS_DOT: Record<string, string> = {
  active:  "bg-emerald-400",
  paused:  "bg-yellow-400",
  idle:    "bg-slate-400",
  error:   "bg-red-400",
};
const STATUS_LABEL: Record<string, string> = {
  active: "Aktiv", paused: "Pausiert", idle: "Idle", error: "Fehler",
};

export function AgentList({ agents: initial }: { agents: unknown[] }) {
  const router = useRouter();
  const [agents, setAgents] = useState<Agent[]>(initial as Agent[]);
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("Alle");
  const [filterStatus, setFilterStatus] = useState("Alle");
  const [pending, startTransition] = useTransition();

  const categories = ["Alle", ...Array.from(new Set(agents.map(a => a.category)))];
  const statuses   = ["Alle", "active", "paused", "idle", "error"];

  const filtered = agents.filter(a => {
    const matchCat    = filterCat    === "Alle" || a.category === filterCat;
    const matchStatus = filterStatus === "Alle" || a.status   === filterStatus;
    const matchSearch = !search || a.name.toLowerCase().includes(search.toLowerCase()) ||
      (a.description ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (a.tags ?? []).some(t => t.toLowerCase().includes(search.toLowerCase()));
    return matchCat && matchStatus && matchSearch;
  });

  async function handleToggle(id: string, e: React.MouseEvent) {
    e.preventDefault();
    const res = await fetch(`/api/agents/${id}/toggle`, { method: "POST" });
    if (res.ok) {
      const updated: Agent = await res.json();
      setAgents(prev => prev.map(a => a.id === updated.id ? updated : a));
    }
  }

  function formatDate(iso?: string | null) {
    if (!iso) return "–";
    return new Date(iso).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit" });
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
            placeholder="Name, Beschreibung, Tag..."
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--muted-foreground)]"
          />
        </div>
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="size-3.5 text-[var(--muted-foreground)]" />
          <select
            value={filterCat}
            onChange={e => setFilterCat(e.target.value)}
            className="rounded-[14px] border border-white/10 bg-black/40 px-3 py-1.5 text-sm text-white outline-none"
          >
            {categories.map(c => <option key={c}>{c}</option>)}
          </select>
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="rounded-[14px] border border-white/10 bg-black/40 px-3 py-1.5 text-sm text-white outline-none"
          >
            {statuses.map(s => <option key={s} value={s}>{s === "Alle" ? "Alle Status" : STATUS_LABEL[s]}</option>)}
          </select>
        </div>
        <p className="text-xs text-[var(--muted-foreground)]">{filtered.length} Agent{filtered.length !== 1 ? "s" : ""}</p>
      </div>

      {/* List */}
      <div className="divide-y divide-white/5">
        {filtered.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <Bot className="size-10 opacity-20" />
            <p className="text-sm text-[var(--muted-foreground)]">
              {agents.length === 0 ? "Noch keine Agents angelegt." : "Keine Agents gefunden."}
            </p>
            {agents.length === 0 && (
              <Link
                href="/agents/new"
                className="mt-1 rounded-[16px] border border-[rgba(90,196,255,0.3)] bg-[rgba(90,196,255,0.08)] px-4 py-2 text-sm text-[var(--accent)]"
              >
                Ersten Agent anlegen →
              </Link>
            )}
          </div>
        )}

        {filtered.map(agent => (
          <Link
            key={agent.id}
            href={`/agents/${agent.id}`}
            className="group flex items-center gap-4 px-5 py-4 transition hover:bg-white/3"
          >
            {/* Status dot + Icon */}
            <div className="relative shrink-0">
              <div className="flex size-10 items-center justify-center rounded-[14px] bg-white/6">
                <Bot className="size-5 text-[var(--muted-foreground)]" />
              </div>
              <span className={`absolute -right-0.5 -top-0.5 size-2.5 rounded-full border-2 border-black ${STATUS_DOT[agent.status] ?? "bg-slate-400"}`} />
            </div>

            {/* Main info */}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-medium text-white truncate">{agent.name}</p>
                <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-[var(--muted-foreground)]">
                  {agent.category}{agent.subCategory ? ` › ${agent.subCategory}` : ""}
                </span>
                {agent.tags?.slice(0, 2).map(t => (
                  <span key={t} className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-[var(--muted-foreground)]">{t}</span>
                ))}
              </div>
              <p className="mt-0.5 truncate text-xs text-[var(--muted-foreground)]">
                {agent.description || "Keine Beschreibung"} · Owner: {agent.owner || "–"}
              </p>
            </div>

            {/* Stats */}
            <div className="hidden shrink-0 text-right text-xs text-[var(--muted-foreground)] sm:block">
              <p>{agent.runCount ?? 0} Läufe</p>
              <p>Letzter: {formatDate(agent.lastRun)}</p>
            </div>

            {/* Toggle + Arrow */}
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={e => handleToggle(agent.id, e)}
                className="rounded-[12px] border border-white/10 bg-white/5 p-2 transition hover:border-white/20 hover:bg-white/10"
                title={agent.status === "active" ? "Pausieren" : "Aktivieren"}
              >
                {agent.status === "active"
                  ? <Pause className="size-3.5 text-yellow-400" />
                  : <Play  className="size-3.5 text-emerald-400" />}
              </button>
              <ChevronRight className="size-4 text-[var(--muted-foreground)] transition group-hover:text-white" />
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
