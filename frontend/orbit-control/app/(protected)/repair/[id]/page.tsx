import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, AlertTriangle, Moon, Archive } from "lucide-react";
import { orbitFetch } from "@/lib/core/orbit-fetch";
import { IncidentActions } from "@/components/repair/incident-actions";

interface AIAnalysis {
  rootCause: string;
  suggestedFix: string | null;
  confidence: number;
  applyCommand: string | null;
  explanation: string;
  preventionNote: string;
  analyzedAt: string;
}

interface Incident {
  id: string;
  level: 1 | 2 | 3;
  source: string;
  error: string;
  stack: string;
  status: string;
  occurrences: number;
  affectedFile: string | null;
  aiAnalysis: AIAnalysis | null;
  suggestedFix: string | null;
  confidence: number | null;
  adminNotified: boolean;
  notes: string;
  createdAt: string;
  updatedAt: string;
  scheduledFor: string | null;
  resolvedAt: string | null;
}

const LEVEL_CONFIG = {
  1: { label: "L1 — Kritisch (Sofort)",   color: "text-red-400",    border: "border-red-500/30",    bg: "bg-red-500/8"    },
  2: { label: "L2 — Night-Slot",           color: "text-yellow-400", border: "border-yellow-500/30", bg: "bg-yellow-500/8" },
  3: { label: "L3 — Nächstes Release",     color: "text-slate-400",  border: "border-white/10",      bg: "bg-white/5"      },
} as const;

const STATUS_LABEL: Record<string, string> = {
  open: "Offen", analyzing: "Analyse läuft…", fix_ready: "Fix bereit",
  approved: "Genehmigt", applied: "Angewendet", resolved: "Gelöst", deferred: "Zurückgestellt",
};

function fmt(iso?: string | null) {
  if (!iso) return "–";
  return new Date(iso).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export default async function IncidentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { data, ok } = await orbitFetch<Incident>(`/selfrepair/${id}`);
  if (!ok || !data) notFound();

  const lvl = LEVEL_CONFIG[data.level] ?? LEVEL_CONFIG[3];

  return (
    <div className="space-y-4">
      <Link href="/repair" className="inline-flex items-center gap-2 text-sm text-[var(--muted-foreground)] transition hover:text-white">
        <ChevronLeft className="size-4" /> Alle Incidents
      </Link>

      {/* Header */}
      <section className="rounded-[32px] border border-white/10 bg-black/20 p-6 backdrop-blur">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className={`flex size-12 shrink-0 items-center justify-center rounded-[18px] border ${lvl.border} ${lvl.bg}`}>
              {data.level === 1 ? <AlertTriangle className={`size-6 ${lvl.color}`} /> :
               data.level === 2 ? <Moon          className={`size-6 ${lvl.color}`} /> :
                                  <Archive       className={`size-6 ${lvl.color}`} />}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className={`text-xs font-semibold uppercase tracking-wider ${lvl.color}`}>{lvl.label}</span>
                <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] text-white/60">
                  {STATUS_LABEL[data.status] ?? data.status}
                </span>
                {data.occurrences > 1 && (
                  <span className="rounded-full border border-orange-500/20 bg-orange-500/8 px-2 py-0.5 text-[11px] text-orange-300">
                    {data.occurrences}× aufgetreten
                  </span>
                )}
              </div>
              <h2 className="mt-1 text-lg font-semibold text-white">{data.error || "Unbekannter Fehler"}</h2>
              <p className="mt-1 text-sm text-[var(--muted-foreground)]">Service: {data.source || "–"}</p>
            </div>
          </div>
          <IncidentActions incidentId={data.id} status={data.status} />
        </div>
      </section>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Erstellt",       value: fmt(data.createdAt) },
          { label: "Geplant für",    value: fmt(data.scheduledFor) },
          { label: "Gelöst",         value: fmt(data.resolvedAt) },
          { label: "Konfidenz AI",   value: data.confidence !== null ? `${Math.round((data.confidence ?? 0) * 100)}%` : "–" },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-[20px] border border-white/8 bg-black/20 px-4 py-3">
            <p className="text-[10px] uppercase tracking-widest text-[var(--muted-foreground)]">{label}</p>
            <p className="mt-1 text-sm font-semibold text-white">{value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Stack Trace */}
        <section className="rounded-[24px] border border-white/10 bg-black/20 p-5 backdrop-blur">
          <h3 className="mb-3 text-sm font-semibold text-white">Stack Trace</h3>
          <pre className="whitespace-pre-wrap rounded-[16px] border border-white/8 bg-white/3 p-4 font-mono text-xs text-red-300/80 overflow-auto max-h-64">
            {data.stack || "Kein Stack verfügbar"}
          </pre>
          {data.affectedFile && (
            <p className="mt-2 text-xs text-[var(--muted-foreground)]">
              Betroffene Datei: <span className="font-mono text-[var(--accent)]">{data.affectedFile}</span>
            </p>
          )}
        </section>

        {/* AI-Analyse */}
        <section className="rounded-[24px] border border-white/10 bg-black/20 p-5 backdrop-blur">
          <h3 className="mb-3 text-sm font-semibold text-white">AI-Analyse</h3>
          {data.aiAnalysis ? (
            <div className="space-y-3">
              <div>
                <p className="mb-1 text-[10px] uppercase tracking-widest text-[var(--muted-foreground)]">Root Cause</p>
                <p className="text-sm text-white/80">{data.aiAnalysis.rootCause}</p>
              </div>
              {data.aiAnalysis.explanation && data.aiAnalysis.explanation !== data.aiAnalysis.rootCause && (
                <div>
                  <p className="mb-1 text-[10px] uppercase tracking-widest text-[var(--muted-foreground)]">Erklärung</p>
                  <p className="text-xs text-white/60">{data.aiAnalysis.explanation}</p>
                </div>
              )}
              {data.aiAnalysis.preventionNote && (
                <div>
                  <p className="mb-1 text-[10px] uppercase tracking-widest text-[var(--muted-foreground)]">Prävention</p>
                  <p className="text-xs text-white/60">{data.aiAnalysis.preventionNote}</p>
                </div>
              )}
              <p className="text-[11px] text-[var(--muted-foreground)]">
                Analysiert: {fmt(data.aiAnalysis.analyzedAt)} · Konfidenz: {Math.round((data.aiAnalysis.confidence ?? 0) * 100)}%
              </p>
            </div>
          ) : (
            <p className="text-sm text-[var(--muted-foreground)]">
              {data.status === "analyzing" ? "Analyse läuft…" : "Noch keine AI-Analyse. Klick auf «Analysieren» um zu starten."}
            </p>
          )}
        </section>
      </div>

      {/* Suggested Fix */}
      {data.suggestedFix && (
        <section className="rounded-[24px] border border-emerald-500/20 bg-emerald-500/5 p-5 backdrop-blur">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-emerald-300">Vorgeschlagener Fix</h3>
            {data.aiAnalysis?.applyCommand && (
              <code className="rounded-[10px] border border-white/10 bg-black/30 px-2 py-1 font-mono text-xs text-white/60">
                {data.aiAnalysis.applyCommand}
              </code>
            )}
          </div>
          <pre className="whitespace-pre-wrap rounded-[16px] border border-emerald-500/15 bg-black/20 p-4 font-mono text-xs text-emerald-200/80 overflow-auto max-h-96">
            {data.suggestedFix}
          </pre>
        </section>
      )}

      {/* Admin Notes */}
      <section className="rounded-[24px] border border-white/10 bg-black/20 p-5 backdrop-blur">
        <h3 className="mb-2 text-sm font-semibold text-white">Admin-Notizen</h3>
        <p className="text-sm text-white/60">{data.notes || "Keine Notizen."}</p>
      </section>
    </div>
  );
}
