/**
 * (c) 2026 KI-OS.org by Ingo Schaffer und Kimba
 * License: AGPL-3.0-only (Community) / Proprietär (Enterprise)
 * @desc Scenario Card — Zeigt ein einzelnes Szenario mit Run-Button
 */

"use client";

import { useState } from "react";
import { Loader2, Star } from "lucide-react";
import type { Scenario } from "./playground-shell";

export function ScenarioCard({
  scenario,
  onRun,
  running,
}: {
  scenario: Scenario;
  onRun: (id: string) => void;
  running: boolean;
}) {
  const [isRunning, setIsRunning] = useState(false);

  const handleRun = () => {
    if (running) return;
    setIsRunning(true);
    onRun(scenario.id);
    setTimeout(() => setIsRunning(false), 500);
  };

  const isFork = !!scenario.fork_of;
  const isCurrentlyRunning = isRunning && running;

  const tags = scenario.tags.split(",").map((t) => t.trim()).filter(Boolean);

  return (
    <article className="flex h-full flex-col justify-between rounded-[24px] border border-white/10 bg-black/20 p-5 backdrop-blur transition hover:border-white/20">
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-base font-semibold" style={{ color: "var(--foreground)" }}>
            {scenario.title}
          </h3>
          {isFork && (
            <span
              className="shrink-0 rounded-full px-2 py-0.5 text-[9px] uppercase tracking-[0.12em]"
              style={{
                backgroundColor: "rgba(251,146,60,0.12)",
                color: "var(--accent-orange)",
                border: "1px solid rgba(251,146,60,0.25)",
              }}
            >
              Fork
            </span>
          )}
        </div>

        <p
          className="line-clamp-2 text-sm"
          style={{ color: "var(--muted-foreground)" }}
        >
          {scenario.description}
        </p>

        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full px-2 py-0.5 text-[10px] uppercase tracking-[0.12em]"
                style={{
                  background: "var(--accent-dim)",
                  color: "var(--accent)",
                }}
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between border-t pt-4" style={{ borderColor: "var(--border)" }}>
        <div className="flex items-center gap-3 text-xs" style={{ color: "var(--muted-foreground)" }}>
          <span className="flex items-center gap-1">
            <Star className="h-3.5 w-3.5" style={{ color: "#fbbf24" }} />
            {scenario.stars}
          </span>
          <span className="flex items-center gap-1">
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
            {scenario.run_count}
          </span>
        </div>

        <button
          type="button"
          onClick={handleRun}
          disabled={isCurrentlyRunning}
          className="inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-medium transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          style={{ background: "var(--accent)", color: "#0a0f1e" }}
        >
          {isCurrentlyRunning ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Läuft...
            </>
          ) : (
            <>
              Run
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
            </>
          )}
        </button>
      </div>
    </article>
  );
}
