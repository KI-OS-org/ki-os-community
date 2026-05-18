/**
 * (c) 2026 KI-OS.org by Ingo Schaffer und Kimba
 * License: AGPL-3.0-only (Community) / Proprietär (Enterprise)
 * @desc Playground Shell — Haupt-Komponente mit Header, Szenario-Grid und Ergebnis-Panel
 */

"use client";

import { useState, useMemo } from "react";
import { ScenarioCard } from "./scenario-card";
import { RunResultPanel } from "./run-result-panel";

export type Scenario = {
  id: string;
  title: string;
  description: string;
  tags: string;
  author: string;
  stars: number;
  run_count: number;
  fork_of?: string;
};

export type RunStep = {
  type: string;
  label: string;
  timestamp_ms: number;
  severity: string;
  payload: Record<string, unknown>;
};

export type RunResult = {
  runId: string;
  scenarioId: string;
  scenarioTitle: string;
  duration_ms: number;
  steps: RunStep[];
  status: string;
};

export function PlaygroundShell({ scenarios }: { scenarios: Scenario[] }) {
  const [activeTag, setActiveTag] = useState<string>("all");
  const [activeRun, setActiveRun] = useState<RunResult | null>(null);
  const [running, setRunning] = useState<boolean>(false);

  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    scenarios.forEach((s) => {
      s.tags.split(",").forEach((t) => {
        const trimmed = t.trim();
        if (trimmed) tagSet.add(trimmed);
      });
    });
    return ["all", ...Array.from(tagSet)];
  }, [scenarios]);

  const filteredScenarios = useMemo(() => {
    if (activeTag === "all") return scenarios;
    return scenarios.filter((s) =>
      s.tags.split(",").some((t) => t.trim() === activeTag)
    );
  }, [scenarios, activeTag]);

  const handleRun = async (scenarioId: string) => {
    setRunning(true);
    try {
      const res = await fetch("/api/playground/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenarioId }),
      });
      if (res.ok) {
        const result: RunResult = await res.json();
        setActiveRun(result);
      }
    } catch {
      // silent fail
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <section className="rounded-[32px] border border-white/10 bg-black/20 p-6 backdrop-blur">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <div
              className="inline-flex rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.18em]"
              style={{
                backgroundColor: "color-mix(in srgb, var(--accent) 14%, transparent)",
                color: "var(--accent)",
              }}
            >
              Twin Playground
            </div>
            <h1 className="text-3xl font-semibold tracking-[-0.03em]" style={{ color: "var(--foreground)" }}>
              Risikofreies Experimentieren mit KI-OS Agents
            </h1>
            <p className="max-w-3xl text-sm" style={{ color: "var(--muted-foreground)" }}>
              Wähle ein Szenario, starte einen Run und analysiere die Agent-Entscheidungen im Detail.
            </p>
          </div>
        </div>

        {/* Tag Filter */}
        <div className="mt-6 flex flex-wrap gap-2">
          {allTags.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => setActiveTag(tag)}
              className="rounded-full px-4 py-1.5 text-xs font-medium transition hover:opacity-90"
              style={
                activeTag === tag
                  ? { background: "var(--accent)", color: "#0a0f1e" }
                  : {
                      background: "var(--accent-dim)",
                      border: "1px solid rgba(90,196,255,0.22)",
                      color: "var(--accent)",
                    }
              }
            >
              {tag === "all" ? "Alle" : tag}
            </button>
          ))}
        </div>
      </section>

      {/* Main Content */}
      <div className="grid gap-4 xl:grid-cols-[1fr_400px]">
        {/* Szenario Grid */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>
              Szenarien {filteredScenarios.length > 0 && `(${filteredScenarios.length})`}
            </p>
          </div>

          {filteredScenarios.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {filteredScenarios.map((scenario) => (
                <ScenarioCard
                  key={scenario.id}
                  scenario={scenario}
                  onRun={handleRun}
                  running={running}
                />
              ))}
            </div>
          ) : (
            <div
              className="rounded-[24px] border border-white/10 bg-black/20 p-8 text-center backdrop-blur"
              style={{ color: "var(--muted-foreground)" }}
            >
              <p className="text-sm">Keine Szenarien für diesen Filter gefunden.</p>
            </div>
          )}
        </section>

        {/* Ergebnis Panel */}
        <aside>
          {activeRun ? (
            <RunResultPanel result={activeRun} />
          ) : (
            <div
              className="rounded-[24px] border border-white/10 bg-black/20 p-6 backdrop-blur"
              style={{ color: "var(--muted-foreground)" }}
            >
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div
                  className="mb-4 flex h-12 w-12 items-center justify-center rounded-full"
                  style={{ background: "var(--accent-dim)" }}
                >
                  <svg
                    className="h-6 w-6"
                    style={{ color: "var(--accent)" }}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <p className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
                  Wähle ein Szenario
                </p>
                <p className="mt-1 text-xs">
                  Starte einen Run, um die Agent-Ausführung zu analysieren.
                </p>
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
