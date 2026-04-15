"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Activity, ArrowLeft, CheckCircle, ChevronDown, ChevronRight,
  Clock, Code, Loader2, Play, RotateCcw, Terminal, XCircle, Zap,
} from "lucide-react";
import { ConfidenceBadge } from "@/components/confidence/confidence-badge";
import { VerifierScorePanel } from "@/components/confidence/verifier-score-panel";

// ── Types ─────────────────────────────────────────────────────────────────────
type Run    = Record<string, unknown>;
type Ev     = Record<string, unknown>;

// ── Helpers ────────────────────────────────────────────────────────────────────
const PHASES = ["queued","planning","researching","executing","verifying","done"] as const;
type Phase = typeof PHASES[number];

const PHASE_LABEL: Record<Phase, string> = {
  queued: "Queued", planning: "Planning", researching: "Recherche",
  executing: "Executing", verifying: "Verifying", done: "Done",
};

function phaseIndex(status: string): number {
  const s = status?.toLowerCase() as Phase;
  const i = PHASES.indexOf(s);
  return i === -1 ? (status === "completed" ? PHASES.length - 1 : -1) : i;
}

function fmt(iso: string) {
  try { return new Date(iso).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "medium" }); }
  catch { return iso; }
}

// ── AgentPhaseRail ─────────────────────────────────────────────────────────────
function AgentPhaseRail({ status }: { status: string }) {
  const current = phaseIndex(status);
  const failed  = status?.toLowerCase() === "failed";
  return (
    <div className="flex items-center gap-0 overflow-x-auto pb-1">
      {PHASES.map((phase, i) => {
        const done    = !failed && i < current;
        const active  = !failed && i === current;
        const isFail  = failed && i === current;
        return (
          <div key={phase} className="flex items-center min-w-0">
            <div className={`flex flex-col items-center px-3 py-2 rounded-xl text-xs transition ${
              active  ? "border border-cyan-500/40 bg-cyan-500/10"   :
              isFail  ? "border border-red-500/40 bg-red-500/10"     :
              done    ? "border border-emerald-500/30 bg-emerald-500/8" :
              "border border-white/8 bg-white/3"
            }`}>
              <span className={`font-semibold ${
                active ? "text-cyan-400" : isFail ? "text-red-400" : done ? "text-emerald-400" : "text-white/30"
              }`}>
                {isFail ? "✗" : done ? "✓" : active ? "●" : "○"}
              </span>
              <span className={`mt-0.5 ${done || active ? "opacity-100" : "opacity-30"}`} style={{ color: "var(--muted-foreground)" }}>
                {PHASE_LABEL[phase]}
              </span>
            </div>
            {i < PHASES.length - 1 && (
              <div className={`h-px w-6 shrink-0 ${i < current ? "bg-emerald-500/40" : "bg-white/8"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── ToolCallLog ────────────────────────────────────────────────────────────────
function ToolCallLog({ toolCalls }: { toolCalls: unknown[] }) {
  const [open, setOpen] = useState<number | null>(null);
  if (!toolCalls.length) return (
    <p className="text-xs py-4 text-center" style={{ color: "var(--muted-foreground)" }}>
      Keine Tool-Calls für diesen Run erfasst.
    </p>
  );
  return (
    <div className="space-y-2">
      {toolCalls.map((tc, i) => {
        const t   = tc as Record<string, unknown>;
        const ok  = String(t.status ?? t.result ?? "ok").toLowerCase() !== "error";
        const isOpen = open === i;
        return (
          <div key={i} className="rounded-xl border text-xs transition"
            style={{ borderColor: ok ? "rgba(34,197,94,0.20)" : "rgba(248,113,113,0.20)", background: ok ? "rgba(34,197,94,0.04)" : "rgba(248,113,113,0.04)" }}>
            <button className="w-full flex items-center gap-2 px-3 py-2.5 text-left" onClick={() => setOpen(isOpen ? null : i)}>
              {ok ? <CheckCircle className="size-3.5 text-emerald-400 shrink-0" /> : <XCircle className="size-3.5 text-red-400 shrink-0" />}
              <Terminal className="size-3 shrink-0" style={{ color: "var(--muted-foreground)" }} />
              <span className="font-mono font-medium flex-1" style={{ color: "var(--foreground)" }}>
                {String(t.tool ?? t.name ?? `tool-${i}`)}
              </span>
              <span style={{ color: "var(--muted-foreground)" }}>{isOpen ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}</span>
            </button>
            {isOpen && (
              <div className="border-t px-3 py-2 space-y-2" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
                {t.input  != null && <div><p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: "var(--muted-foreground)" }}>Input</p><pre className="text-[11px] font-mono whitespace-pre-wrap break-all" style={{ color: "var(--foreground)" }}>{JSON.stringify(t.input,  null, 2)}</pre></div>}
                {t.output != null && <div><p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: "var(--muted-foreground)" }}>Output</p><pre className="text-[11px] font-mono whitespace-pre-wrap break-all" style={{ color: "var(--foreground)" }}>{JSON.stringify(t.output, null, 2)}</pre></div>}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── RunDetailShell ─────────────────────────────────────────────────────────────
export function RunDetailShell({ run, events }: { run: Run; events: Ev[] }) {
  const router   = useRouter();
  const [replaying, setReplaying] = useState(false);
  const [replayResult, setReplayResult] = useState<string | null>(null);

  const runId    = String(run?.runId  ?? run?.id ?? "");
  const status   = String(run?.status ?? "");
  const model    = String(run?.model  ?? run?.agentId ?? "");
  const task     = String(run?.task   ?? run?.type ?? "Agent Task");
  const conf     = typeof run?.confidence === "number" ? run.confidence : undefined;
  const checks   = Array.isArray(run?.policyChecks) ? run.policyChecks as { policy: string; result: string }[] : [];
  const toolCalls = Array.isArray(run?.toolCalls) ? run.toolCalls : [];

  // Filter events belonging to this run
  const runEvents = events.filter((e) => {
    const eid = String(e.runId ?? e.id ?? "");
    return !eid || eid === runId;
  });

  const handleReplay = async () => {
    setReplaying(true);
    try {
      const r = await fetch("/api/automation/replay", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ runId }),
      });
      const j = await r.json();
      setReplayResult(JSON.stringify(j, null, 2));
    } catch (e) {
      setReplayResult(String(e));
    } finally {
      setReplaying(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <section className="rounded-[32px] border border-white/10 bg-black/20 backdrop-blur p-5">
        <button onClick={() => router.back()} className="flex items-center gap-2 text-sm mb-4 hover:opacity-80 transition"
          style={{ color: "var(--muted-foreground)" }}>
          <ArrowLeft className="size-4" /> Zurück zu Runs
        </button>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Activity className="size-5" style={{ color: "var(--accent)" }} />
              <span className="text-xs font-mono px-2 py-0.5 rounded-lg" style={{ background: "rgba(90,196,255,0.10)", color: "var(--accent)" }}>
                {runId}
              </span>
              {conf !== undefined && <ConfidenceBadge score={conf} />}
            </div>
            <h1 className="text-xl font-bold" style={{ color: "var(--foreground)" }}>{task}</h1>
            {model && <p className="text-sm mt-1" style={{ color: "var(--muted-foreground)" }}>Modell: {model}</p>}
          </div>
          <div className="flex gap-2">
            <button onClick={handleReplay} disabled={replaying}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition"
              style={{ background: "rgba(90,196,255,0.10)", border: "1px solid rgba(90,196,255,0.22)", color: "var(--accent)" }}>
              {replaying ? <Loader2 className="size-4 animate-spin" /> : <RotateCcw className="size-4" />}
              Replay
            </button>
          </div>
        </div>
      </section>

      {/* Phase Rail */}
      <section className="rounded-[24px] border border-white/10 bg-black/20 backdrop-blur px-5 py-4">
        <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--muted-foreground)" }}>
          Ausführungsphasen
        </p>
        <AgentPhaseRail status={status} />
      </section>

      {/* Main columns */}
      <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
        {/* Tool call log */}
        <section className="rounded-[24px] border border-white/10 bg-black/20 backdrop-blur p-5">
          <div className="flex items-center gap-2 mb-4">
            <Code className="size-4" style={{ color: "var(--accent)" }} />
            <h2 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>Tool Calls</h2>
            <span className="pill-cyan ml-auto">{toolCalls.length}</span>
          </div>
          <ToolCallLog toolCalls={toolCalls} />

          {runEvents.length > 0 && (
            <div className="mt-5 pt-4 border-t" style={{ borderColor: "var(--border)" }}>
              <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--muted-foreground)" }}>
                Events ({runEvents.length})
              </p>
              <div className="space-y-1.5 max-h-64 overflow-y-auto">
                {runEvents.slice(0, 30).map((ev, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs py-1">
                    <Zap className="size-3 shrink-0 mt-0.5 text-cyan-400" />
                    <span className="font-mono text-[11px]" style={{ color: "var(--foreground)" }}>
                      {String(ev.type ?? ev.event ?? ev.action ?? "event")}
                    </span>
                    {ev.timestamp != null && (
                      <span className="ml-auto shrink-0" style={{ color: "var(--muted-foreground)" }}>
                        {fmt(String(ev.timestamp))}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Verifier panel */}
        <aside className="space-y-4">
          <VerifierScorePanel policyChecks={checks} confidence={conf} model={model} />

          {/* Raw run data */}
          <details className="glass-card p-4">
            <summary className="text-xs font-semibold cursor-pointer" style={{ color: "var(--muted-foreground)" }}>
              Run Metadaten anzeigen
            </summary>
            <pre className="mt-3 text-[11px] font-mono overflow-auto max-h-64 whitespace-pre-wrap break-all"
              style={{ color: "var(--foreground)" }}>
              {JSON.stringify(run, null, 2)}
            </pre>
          </details>

          {replayResult && (
            <div className="glass-card p-4">
              <p className="text-xs font-semibold mb-2" style={{ color: "var(--accent)" }}>Replay Ergebnis</p>
              <pre className="text-[11px] font-mono whitespace-pre-wrap break-all max-h-48 overflow-auto"
                style={{ color: "var(--foreground)" }}>
                {replayResult}
              </pre>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
