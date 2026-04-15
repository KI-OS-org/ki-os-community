import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Bot, Pause, Play, Trash2, Pencil, History } from "lucide-react";
import { orbitFetch } from "@/lib/core/orbit-fetch";
import { Badge } from "@/components/ui/badge";
import { AgentDetailActions } from "@/components/agents/agent-detail-actions";

interface Agent {
  id: string; name: string; category: string; subCategory?: string;
  owner?: string; status: string; domain: string; description?: string;
  systemPrompt?: string; tags?: string[]; tools?: string[];
  visibleTo?: string[]; createdAt: string; updatedAt?: string;
  lastRun?: string; runCount?: number; errorCount?: number;
}

const STATUS_STYLE: Record<string, { dot: string; badge: string; label: string }> = {
  active:  { dot: "bg-emerald-400", badge: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300", label: "Aktiv" },
  paused:  { dot: "bg-yellow-400",  badge: "border-yellow-500/30 bg-yellow-500/10 text-yellow-300",   label: "Pausiert" },
  idle:    { dot: "bg-slate-400",   badge: "border-white/20 bg-white/5 text-white/60",                 label: "Idle" },
  error:   { dot: "bg-red-400",     badge: "border-red-500/30 bg-red-500/10 text-red-300",             label: "Fehler" },
};

export default async function AgentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { data, ok } = await orbitFetch<Agent>(`/agents/${id}`);
  if (!ok || !data) notFound();
  const agent = data;
  const st = STATUS_STYLE[agent.status] ?? STATUS_STYLE.idle;

  function fmt(iso?: string | null) {
    if (!iso) return "–";
    return new Date(iso).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
  }

  return (
    <div className="space-y-4">
      <Link href="/agents" className="inline-flex items-center gap-2 text-sm text-[var(--muted-foreground)] transition hover:text-white">
        <ChevronLeft className="size-4" /> Alle Agents
      </Link>

      {/* Header Card */}
      <section className="rounded-[32px] border border-white/10 bg-black/20 p-6 backdrop-blur">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="relative shrink-0">
              <div className="flex size-14 items-center justify-center rounded-[20px] bg-[rgba(90,196,255,0.10)]">
                <Bot className="size-7 text-[var(--accent)]" />
              </div>
              <span className={`absolute -right-1 -top-1 size-3.5 rounded-full border-2 border-black ${st.dot}`} />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-semibold text-white">{agent.name}</h2>
                <Badge className={st.badge}>{st.label}</Badge>
              </div>
              <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                {agent.category}{agent.subCategory ? ` › ${agent.subCategory}` : ""} · Domain: {agent.domain}
              </p>
              {agent.description && (
                <p className="mt-2 text-sm text-white/70">{agent.description}</p>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
              <Link
                href={`/agents/${agent.id}/edit`}
                className="inline-flex items-center gap-2 rounded-[18px] border border-[rgba(90,196,255,0.3)] bg-[rgba(90,196,255,0.08)] px-4 py-2 text-sm font-medium text-[var(--accent)] transition hover:bg-[rgba(90,196,255,0.15)]"
              >
                <Pencil className="size-4" />
                Bearbeiten
              </Link>
              <Link
                href={`/agents/${agent.id}/runs`}
                className="inline-flex items-center gap-2 rounded-[18px] border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-[var(--muted-foreground)] transition hover:bg-white/8 hover:text-white"
              >
                <History className="size-4" />
                Run History
              </Link>
              <AgentDetailActions agentId={agent.id} status={agent.status} />
            </div>
        </div>
      </section>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Gesamt Läufe", value: agent.runCount ?? 0 },
          { label: "Fehler",       value: agent.errorCount ?? 0 },
          { label: "Letzter Lauf", value: fmt(agent.lastRun) },
          { label: "Erstellt",     value: fmt(agent.createdAt) },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-[20px] border border-white/8 bg-black/20 px-4 py-3">
            <p className="text-[10px] uppercase tracking-widest text-[var(--muted-foreground)]">{label}</p>
            <p className="mt-1 text-sm font-semibold text-white">{value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Konfiguration */}
        <section className="rounded-[24px] border border-white/10 bg-black/20 p-5 backdrop-blur">
          <h3 className="mb-4 text-sm font-semibold text-white">Konfiguration</h3>
          <div className="space-y-3">
            <Row label="Owner"     value={agent.owner || "–"} />
            <Row label="Domain"    value={agent.domain} />
            <Row label="Zuletzt geändert" value={fmt(agent.updatedAt)} />
          </div>

          {agent.tags && agent.tags.length > 0 && (
            <div className="mt-4">
              <p className="mb-2 text-[10px] uppercase tracking-widest text-[var(--muted-foreground)]">Tags</p>
              <div className="flex flex-wrap gap-1.5">
                {agent.tags.map(t => (
                  <span key={t} className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-xs text-white/70">{t}</span>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Sichtbarkeit + Tools */}
        <section className="rounded-[24px] border border-white/10 bg-black/20 p-5 backdrop-blur">
          <h3 className="mb-4 text-sm font-semibold text-white">Sichtbarkeit & Tools</h3>

          <p className="mb-2 text-[10px] uppercase tracking-widest text-[var(--muted-foreground)]">Sichtbar für</p>
          <div className="flex flex-wrap gap-1.5">
            {(agent.visibleTo ?? []).map(r => (
              <span key={r} className="rounded-full border border-emerald-500/30 bg-emerald-500/8 px-2.5 py-0.5 text-xs text-emerald-300">{r}</span>
            ))}
          </div>

          <p className="mb-2 mt-4 text-[10px] uppercase tracking-widest text-[var(--muted-foreground)]">Tools</p>
          <div className="flex flex-wrap gap-1.5">
            {(agent.tools ?? []).map(t => (
              <span key={t} className="rounded-full border border-[rgba(90,196,255,0.2)] bg-[rgba(90,196,255,0.06)] px-2.5 py-0.5 text-xs text-[var(--accent)]">{t}</span>
            ))}
          </div>
        </section>
      </div>

      {/* System Prompt */}
      {agent.systemPrompt && (
        <section className="rounded-[24px] border border-white/10 bg-black/20 p-5 backdrop-blur">
          <h3 className="mb-3 text-sm font-semibold text-white">System Prompt</h3>
          <pre className="whitespace-pre-wrap rounded-[18px] border border-white/8 bg-white/4 p-4 font-mono text-xs text-white/70">
            {agent.systemPrompt}
          </pre>
        </section>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-[14px] border border-white/6 bg-white/3 px-3 py-2">
      <span className="text-xs text-[var(--muted-foreground)]">{label}</span>
      <span className="text-xs font-medium text-white">{value}</span>
    </div>
  );
}
