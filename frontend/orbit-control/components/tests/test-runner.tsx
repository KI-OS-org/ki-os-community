"use client";

import { useState, useRef, useCallback } from "react";
import {
  Play, Square, RotateCcw, CheckCircle, XCircle,
  AlertTriangle, SkipForward, Loader2, Download, ChevronDown, ChevronRight,
} from "lucide-react";
import { runTests, type TestResult, type TestStatus } from "@/lib/tests/runner";
import { ALL_TEST_STEPS, SUITE_NAMES } from "@/lib/tests/suites";

// ---------------------------------------------------------------------------
// Status config
// ---------------------------------------------------------------------------
const STATUS_CONFIG: Record<TestStatus, { icon: React.ReactNode; color: string; label: string }> = {
  pending: { icon: <span className="size-4 rounded-full border border-white/20 bg-white/5" />, color: "text-white/30", label: "Ausstehend" },
  running: { icon: <Loader2 className="size-4 animate-spin text-[var(--accent)]" />, color: "text-[var(--accent)]", label: "Läuft…" },
  pass:    { icon: <CheckCircle className="size-4 text-emerald-400" />, color: "text-emerald-300", label: "OK" },
  fail:    { icon: <XCircle className="size-4 text-red-400" />, color: "text-red-300", label: "Fehler" },
  warn:    { icon: <AlertTriangle className="size-4 text-yellow-400" />, color: "text-yellow-300", label: "Warnung" },
  skip:    { icon: <SkipForward className="size-4 text-white/30" />, color: "text-white/30", label: "Übersprungen" },
};

// ---------------------------------------------------------------------------
// Suite progress bar
// ---------------------------------------------------------------------------
function SuiteBar({ name, results }: { name: string; results: TestResult[] }) {
  const [open, setOpen] = useState(true);
  const suite = results.filter(r => r.group === name);
  const pass  = suite.filter(r => r.status === "pass").length;
  const fail  = suite.filter(r => r.status === "fail").length;
  const warn  = suite.filter(r => r.status === "warn").length;
  const total = ALL_TEST_STEPS.filter(s => s.group === name).length;
  const done  = suite.filter(r => r.status !== "running" && r.status !== "pending").length;

  const pct   = total > 0 ? Math.round((done / total) * 100) : 0;
  const color = fail > 0 ? "bg-red-500" : warn > 0 ? "bg-yellow-500" : done === total && total > 0 ? "bg-emerald-500" : "bg-[var(--accent)]";

  return (
    <div className="rounded-[20px] border border-white/10 bg-black/20 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-center gap-3 px-4 py-3 transition hover:bg-white/3"
      >
        {open ? <ChevronDown className="size-4 shrink-0 text-[var(--muted-foreground)]" /> : <ChevronRight className="size-4 shrink-0 text-[var(--muted-foreground)]" />}
        <span className="flex-1 text-left text-sm font-medium text-white">{name}</span>
        <span className="text-xs text-[var(--muted-foreground)]">
          {pass > 0 && <span className="text-emerald-400">{pass}✓ </span>}
          {fail > 0 && <span className="text-red-400">{fail}✗ </span>}
          {warn > 0 && <span className="text-yellow-400">{warn}⚠ </span>}
          <span className="text-white/40">{done}/{total}</span>
        </span>
        {/* Progress bar */}
        <div className="w-24 h-1.5 rounded-full bg-white/10 overflow-hidden">
          <div className={`h-full rounded-full transition-all duration-300 ${color}`} style={{ width: `${pct}%` }} />
        </div>
      </button>

      {open && (
        <div className="border-t border-white/5 divide-y divide-white/5">
          {ALL_TEST_STEPS.filter(s => s.group === name).map(step => {
            const r = results.find(r => r.id === step.id);
            const status: TestStatus = r?.status ?? "pending";
            const cfg = STATUS_CONFIG[status];
            return (
              <div key={step.id} className="flex items-start gap-3 px-4 py-2.5 group">
                <div className="mt-0.5 shrink-0">{cfg.icon}</div>
                <div className="min-w-0 flex-1">
                  <p className={`text-sm ${cfg.color}`}>{step.name}</p>
                  {r?.message && r.status !== "pending" && (
                    <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">{r.message}</p>
                  )}
                  {r?.detail && (
                    <p className="mt-0.5 truncate font-mono text-[10px] text-white/30">{r.detail}</p>
                  )}
                </div>
                {r?.durationMs !== undefined && r.durationMs > 0 && (
                  <span className="shrink-0 text-[10px] text-white/20">{r.durationMs}ms</span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Summary bar
// ---------------------------------------------------------------------------
function Summary({ results, running }: { results: TestResult[]; running: boolean }) {
  const total   = results.length;
  const pass    = results.filter(r => r.status === "pass").length;
  const fail    = results.filter(r => r.status === "fail").length;
  const warn    = results.filter(r => r.status === "warn").length;
  const skip    = results.filter(r => r.status === "skip").length;
  const allDone = !running && total > 0;

  const overallColor = fail > 0 ? "border-red-500/30 bg-red-500/8" : warn > 0 ? "border-yellow-500/30 bg-yellow-500/8" : allDone ? "border-emerald-500/30 bg-emerald-500/8" : "border-white/10 bg-white/5";
  const overallText  = fail > 0 ? "text-red-300" : warn > 0 ? "text-yellow-300" : allDone ? "text-emerald-300" : "text-white/60";

  return (
    <div className={`rounded-[20px] border px-5 py-4 ${overallColor}`}>
      <div className="flex flex-wrap items-center gap-4">
        <p className={`text-sm font-semibold ${overallText}`}>
          {running ? "Tests laufen…" : allDone ? (fail === 0 ? "Alle Tests bestanden" : `${fail} Test(s) fehlgeschlagen`) : "Bereit"}
        </p>
        {total > 0 && (
          <>
            <span className="text-sm text-emerald-400">{pass} OK</span>
            {fail > 0  && <span className="text-sm text-red-400">{fail} Fehler</span>}
            {warn > 0  && <span className="text-sm text-yellow-400">{warn} Warnungen</span>}
            {skip > 0  && <span className="text-sm text-white/30">{skip} Übersprungen</span>}
            <span className="text-sm text-white/30">{total} gesamt</span>
          </>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------
export function TestRunner() {
  const [results, setResults]   = useState<TestResult[]>([]);
  const [running, setRunning]   = useState(false);
  const abortRef                = useRef<AbortController | null>(null);

  const updateResult = useCallback((r: TestResult) => {
    setResults(prev => {
      const idx = prev.findIndex(x => x.id === r.id);
      if (idx >= 0) { const n = [...prev]; n[idx] = r; return n; }
      return [...prev, r];
    });
  }, []);

  async function start() {
    setResults([]);
    setRunning(true);
    abortRef.current = new AbortController();
    try {
      await runTests(ALL_TEST_STEPS, updateResult, abortRef.current.signal);
    } finally {
      setRunning(false);
    }
  }

  function stop() {
    abortRef.current?.abort();
    setRunning(false);
  }

  function reset() {
    abortRef.current?.abort();
    setRunning(false);
    setResults([]);
  }

  function exportResults() {
    const blob = new Blob([JSON.stringify(results, null, 2)], { type: "application/json" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `ki-os-test-${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const totalSteps = ALL_TEST_STEPS.length;
  const doneSteps  = results.filter(r => r.status !== "running" && r.status !== "pending").length;
  const pct        = totalSteps > 0 ? Math.round((doneSteps / totalSteps) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        {!running ? (
          <button
            type="button"
            onClick={start}
            className="inline-flex items-center gap-2 rounded-[18px] border border-emerald-500/30 bg-emerald-500/10 px-5 py-2.5 text-sm font-semibold text-emerald-300 transition hover:bg-emerald-500/20"
          >
            <Play className="size-4" /> Alle Tests starten
          </button>
        ) : (
          <button
            type="button"
            onClick={stop}
            className="inline-flex items-center gap-2 rounded-[18px] border border-red-500/30 bg-red-500/10 px-5 py-2.5 text-sm font-semibold text-red-300 transition hover:bg-red-500/20"
          >
            <Square className="size-4" /> Stoppen
          </button>
        )}
        <button
          type="button"
          onClick={reset}
          disabled={running}
          className="inline-flex items-center gap-2 rounded-[18px] border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white/60 transition hover:bg-white/10 disabled:opacity-40"
        >
          <RotateCcw className="size-4" /> Reset
        </button>
        {results.length > 0 && !running && (
          <button
            type="button"
            onClick={exportResults}
            className="inline-flex items-center gap-2 rounded-[18px] border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white/60 transition hover:bg-white/10"
          >
            <Download className="size-4" /> Export JSON
          </button>
        )}
        <p className="ml-auto text-xs text-[var(--muted-foreground)]">{totalSteps} Tests · 6 Suiten</p>
      </div>

      {/* Global Progress */}
      {(running || results.length > 0) && (
        <div>
          <div className="mb-1.5 flex items-center justify-between text-xs text-[var(--muted-foreground)]">
            <span>{running ? `Test ${doneSteps + 1}/${totalSteps}` : `${doneSteps}/${totalSteps} abgeschlossen`}</span>
            <span>{pct}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-white/8 overflow-hidden">
            <div
              className="h-full rounded-full bg-[var(--accent)] transition-all duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}

      {/* Summary */}
      <Summary results={results} running={running} />

      {/* Suite Sections */}
      <div className="space-y-2">
        {SUITE_NAMES.map(name => (
          <SuiteBar key={name} name={name} results={results} />
        ))}
      </div>
    </div>
  );
}
