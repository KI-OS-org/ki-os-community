"use client";

/**
 * (c) 2026 KI-OS.org by Ingo Schaffer und Kimba
 * License: AGPL-3.0-only (Community) / Proprietär (Enterprise)
 * @desc Decision Theater — Replay-Ansicht für redigierte Agent-Runs mit Timeline, Szenenpanel und Live-Metriken
 */

import React, { useEffect, useState } from "react";
import { Pause, Play, Share2, Star } from "lucide-react";

type EventType = "reasoning" | "route" | "tool" | "policy" | "memory" | "cost" | "output";

type ReplayEvent = {
  type: EventType;
  label: string;
  t: number;
  cost: number;
};

type SceneConfig = {
  bg: string;
  accent: string;
  label: string;
};

type EventDotProps = {
  type: EventType;
  active: boolean;
  label: string;
  onClick: () => void;
};

const EVENT_COLORS: Record<EventType, string> = {
  reasoning: "var(--accent-purple)",
  route: "var(--accent-orange)",
  tool: "var(--accent-green)",
  policy: "var(--accent-red)",
  memory: "var(--accent-blue)",
  cost: "#c0dd97",
  output: "var(--foreground)",
};

const SCENE_CONFIG: Record<EventType, SceneConfig> = {
  reasoning: {
    bg: "rgba(167,139,250,0.08)",
    accent: "var(--accent-purple)",
    label: "Reasoning",
  },
  route: {
    bg: "rgba(251,146,60,0.08)",
    accent: "var(--accent-orange)",
    label: "Routing Decision",
  },
  tool: {
    bg: "rgba(34,197,94,0.08)",
    accent: "var(--accent-green)",
    label: "Tool Call",
  },
  policy: {
    bg: "rgba(248,113,113,0.08)",
    accent: "var(--accent-red)",
    label: "Policy Check",
  },
  memory: {
    bg: "rgba(74,141,255,0.08)",
    accent: "var(--accent-blue)",
    label: "Memory Access",
  },
  cost: {
    bg: "rgba(192,221,151,0.08)",
    accent: "#c0dd97",
    label: "Cost Update",
  },
  output: {
    bg: "rgba(245,247,255,0.08)",
    accent: "var(--foreground)",
    label: "Final Output",
  },
};

const EVENTS: ReplayEvent[] = [
  { type: "reasoning", label: "Intent-Analyse: Retouren-Anfrage erkannt", t: 0.2, cost: 0.0001 },
  { type: "route", label: "claude-opus-4-6 → kostenintensiv, fallback deepseek", t: 0.8, cost: 0.0003 },
  { type: "memory", label: "Memory Broker: 3 ähnliche Runs gefunden", t: 1.4, cost: 0.0003 },
  { type: "tool", label: "crm.lookup(customer_id) — 142ms", t: 2.1, cost: 0.0004 },
  { type: "reasoning", label: "Retouren-Berechtigung nach AGB §4 bestätigt", t: 3.0, cost: 0.0009 },
  { type: "policy", label: "Policy-Gate: finanzielle Zusage >50€ → approval", t: 3.7, cost: 0.0009 },
  { type: "route", label: "Human in the loop: skip (auto-approved rule)", t: 4.2, cost: 0.001 },
  { type: "tool", label: "crm.create_return(ticket_id) — 238ms", t: 5, cost: 0.0012 },
  { type: "output", label: "Response generiert — 94% voice consistency", t: 5.8, cost: 0.0018 },
];

function EventDot({ type, active, label, onClick }: EventDotProps) {
  const color = EVENT_COLORS[type];

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-2xl py-2 text-left transition hover:bg-white/5"
      style={{ opacity: active ? 1 : 0.45 }}
    >
      <div
        className="h-2 w-2 rounded-full transition-all"
        style={{
          background: color,
          boxShadow: active ? `0 0 0 4px color-mix(in srgb, ${color} 18%, transparent)` : "none",
        }}
      />
      <div className="text-[11px] uppercase tracking-[0.1em]" style={{ color }}>
        {type}
      </div>
      <div className="truncate text-[12px]" style={{ color: "var(--muted-foreground)" }}>
        {label}
      </div>
    </button>
  );
}

export default function TheaterReplayPage() {
  const [activeStep, setActiveStep] = useState<number>(4);
  const [playing, setPlaying] = useState<boolean>(true);
  const [cost, setCost] = useState<number>(0);

  useEffect(() => {
    if (!playing) {
      return undefined;
    }

    const interval = window.setInterval(() => {
      setActiveStep((step) => (step >= EVENTS.length - 1 ? 0 : step + 1));
    }, 1200);

    return () => window.clearInterval(interval);
  }, [playing]);

  useEffect(() => {
    setCost(EVENTS[activeStep]?.cost ?? 0);
  }, [activeStep]);

  const current = EVENTS[activeStep] ?? EVENTS[0];
  const scene = SCENE_CONFIG[current.type];
  const progressWidth = `${((activeStep + 1) / EVENTS.length) * 100}%`;

  return (
    <div className="min-h-screen" style={{ background: "var(--background)", color: "var(--foreground)" }}>
      <div className="mx-auto max-w-[1600px] px-6 py-6 lg:px-8">
        <section className="rounded-[32px] border border-white/10 bg-black/20 p-5 backdrop-blur">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-baseline gap-4">
              <div
                className="text-xs font-mono px-2 py-0.5 rounded-lg"
                style={{ background: "rgba(90,196,255,0.10)", color: "var(--accent)" }}
              >
                ki-os.org · replay
              </div>
              <div className="text-[12px]" style={{ color: "var(--muted-foreground)" }}>
                run / <span style={{ color: "var(--foreground)" }}>a3f9-b821-ccd4</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-[11px]" style={{ color: "var(--muted-foreground)" }}>
              <div>
                <span className="uppercase tracking-wider">tier</span>
                <span className="ml-1.5" style={{ color: "var(--accent-green)" }}>
                  community
                </span>
              </div>
              <div>
                <span className="uppercase tracking-wider">shared by</span>
                <span className="ml-1.5" style={{ color: "var(--foreground)" }}>
                  @ingoschaffer
                </span>
              </div>
              <div>
                <span className="uppercase tracking-wider">redacted</span>
                <span className="ml-1.5" style={{ color: "var(--accent-orange)" }}>
                  ✓ pii · prompts · secrets
                </span>
              </div>
            </div>
          </div>
        </section>

        <section className="pt-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h1 className="text-3xl font-semibold tracking-[-0.02em]">Retail-Agent: Retoure-Bearbeitung Live-Run</h1>
              <div className="mt-3 flex flex-wrap gap-3 text-[12px]" style={{ color: "var(--muted-foreground)" }}>
                <span>9 steps</span>
                <span>5.8s total</span>
                <span>$0.0018 cost</span>
                <span>
                  tagged: <span style={{ color: "var(--foreground)" }}>retail, retouren, agb-parsing</span>
                </span>
              </div>
            </div>

            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-medium transition hover:opacity-90"
              style={{ background: "var(--accent-dim)", border: "1px solid rgba(90,196,255,0.22)", color: "var(--accent)" }}
            >
              <Share2 className="h-4 w-4" />
              Share replay
            </button>
          </div>

          <div className="mt-8 grid grid-cols-1 gap-6 xl:grid-cols-12">
            <aside className="xl:col-span-3">
              <div className="mb-4 text-[11px] uppercase tracking-[0.15em]" style={{ color: "var(--muted-foreground)" }}>
                Timeline
              </div>
              <div className="rounded-[24px] border border-white/10 bg-black/20 p-4 backdrop-blur">
                <div className="space-y-0.5">
                  {EVENTS.map((event, index) => (
                    <EventDot
                      key={`${event.type}-${event.t}`}
                      type={event.type}
                      active={index === activeStep}
                      label={event.label}
                      onClick={() => setActiveStep(index)}
                    />
                  ))}
                </div>
              </div>
            </aside>

            <main className="xl:col-span-6">
              <div
                className="relative overflow-hidden rounded-[24px] border p-8 backdrop-blur transition-all"
                style={{
                  background: scene.bg,
                  borderColor: "color-mix(in srgb, var(--border) 40%, transparent)",
                  minHeight: 440,
                }}
              >
                <div className="mb-6 text-[11px] uppercase tracking-[0.2em]" style={{ color: scene.accent }}>
                  {scene.label} · step {activeStep + 1} / {EVENTS.length}
                </div>

                <div className="mb-8 text-2xl leading-relaxed font-medium">{current.label}</div>

                {current.type === "reasoning" && (
                  <div className="flex flex-wrap items-baseline gap-3">
                    <div
                      className="text-xs font-mono px-2 py-0.5 rounded-lg"
                      style={{ background: "rgba(90,196,255,0.10)", color: "var(--accent)" }}
                    >
                      llm: claude-opus-4-6
                    </div>
                    <div className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>
                      142 tokens in · 87 out · 0.6s
                    </div>
                  </div>
                )}

                {current.type === "route" && (
                  <div className="flex flex-wrap items-baseline gap-3">
                    <div
                      className="text-xs font-mono px-2 py-0.5 rounded-lg"
                      style={{ background: "rgba(90,196,255,0.10)", color: "var(--accent)" }}
                    >
                      fallback triggered
                    </div>
                    <div className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>
                      cost guard: $0.18/run threshold
                    </div>
                  </div>
                )}

                {current.type === "tool" && (
                  <div
                    className="mt-4 rounded-[20px] border p-4 font-mono text-[12px]"
                    style={{
                      background: "rgba(5,8,22,0.8)",
                      borderColor: "color-mix(in srgb, var(--accent-green) 20%, transparent)",
                      color: "var(--muted-foreground)",
                    }}
                  >
                    <div style={{ color: "var(--accent-green)" }}>→ crm.lookup</div>
                    <div className="mt-1">
                      {"{ customer_id: "}
                      <span
                        style={{
                          background: "#3B1515",
                          color: "var(--accent-red)",
                          padding: "0 4px",
                          border: "1px solid #A32D2D",
                        }}
                      >
                        ████████
                      </span>
                      {" }"}
                    </div>
                    <div className="mt-3" style={{ color: "var(--accent-green)" }}>
                      ← status: 200 · 142ms
                    </div>
                  </div>
                )}

                {current.type === "policy" && (
                  <div className="mt-4 space-y-2 font-mono text-[12px]">
                    <div style={{ color: "var(--muted-foreground)" }}>
                      <span style={{ color: "var(--accent-green)" }}>✓</span> Role check: retail_agent
                    </div>
                    <div style={{ color: "var(--muted-foreground)" }}>
                      <span style={{ color: "var(--accent-green)" }}>✓</span> Financial commitment ≤ 50€
                    </div>
                    <div style={{ color: "var(--muted-foreground)" }}>
                      <span style={{ color: "var(--accent-orange)" }}>⚠</span> Auto-approval rule matched
                    </div>
                  </div>
                )}

                <div
                  className="absolute bottom-0 left-0 h-0.5 transition-all"
                  style={{ background: scene.accent, width: progressWidth }}
                />
              </div>

              <div className="mt-4 flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => setPlaying((value) => !value)}
                  className="inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-medium transition hover:opacity-90"
                  style={playing ? { background: "var(--accent)", color: "#0a0f1e" } : { background: "var(--accent-dim)", border: "1px solid rgba(90,196,255,0.22)", color: "var(--accent)" }}
                >
                  {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  {playing ? "Pause" : "Play"}
                </button>
                <div className="h-px flex-1" style={{ background: "var(--border)" }} />
                <div className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>
                  <span className="uppercase tracking-wider">speed</span>
                  <span className="ml-1.5" style={{ color: "var(--foreground)" }}>
                    1.0x
                  </span>
                </div>
              </div>
            </main>

            <aside className="space-y-4 xl:col-span-3">
              <div className="glass-card p-4">
                <div className="mb-3 text-[11px] uppercase tracking-[0.15em]" style={{ color: "var(--muted-foreground)" }}>
                  Live meters
                </div>

                <div className="mb-4">
                  <div className="text-[11px] uppercase tracking-wider" style={{ color: "#c0dd97" }}>
                    Cost
                  </div>
                  <div className="text-2xl font-mono font-light" style={{ color: "#c0dd97" }}>
                    ${cost.toFixed(4)}
                  </div>
                </div>

                <div className="mb-4">
                  <div className="text-[11px] uppercase tracking-wider" style={{ color: "var(--accent-orange)" }}>
                    Provider switches
                  </div>
                  <div className="text-2xl font-mono font-light" style={{ color: "var(--accent-orange)" }}>
                    2
                  </div>
                </div>

                <div>
                  <div className="text-[11px] uppercase tracking-wider" style={{ color: "var(--accent-red)" }}>
                    Policy violations
                  </div>
                  <div className="text-2xl font-mono font-light" style={{ color: "var(--accent-red)" }}>
                    0
                  </div>
                </div>
              </div>

              <div className="rounded-[24px] border border-white/10 bg-black/20 p-4 backdrop-blur">
                <div className="mb-3 text-[11px] uppercase tracking-[0.15em]" style={{ color: "var(--muted-foreground)" }}>
                  Providers used
                </div>
                <div className="space-y-2 text-[12px]">
                  <div className="flex items-center justify-between">
                    <span style={{ color: "var(--foreground)" }}>claude-opus-4-6</span>
                    <span style={{ color: "var(--muted-foreground)" }}>1 call</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span style={{ color: "var(--foreground)" }}>deepseek-v3</span>
                    <span style={{ color: "var(--muted-foreground)" }}>2 calls</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span style={{ color: "var(--foreground)" }}>qwen-2.5-72b</span>
                    <span style={{ color: "var(--muted-foreground)" }}>1 call</span>
                  </div>
                </div>
              </div>

              <div
                className="rounded-[24px] border p-4 backdrop-blur"
                style={{ background: "rgba(90,196,255,0.06)", borderColor: "rgba(90,196,255,0.2)" }}
              >
                <div className="mb-2 flex items-center gap-2 text-[11px] uppercase tracking-[0.15em]" style={{ color: "var(--accent)" }}>
                  <Star className="h-3.5 w-3.5" />
                  Remix this run
                </div>
                <div className="mb-3 text-[12px]" style={{ color: "var(--muted-foreground)" }}>
                  Fork diesen Run in deine eigene KI-OS Instanz und probiere andere Varianten aus.
                </div>
                <button
                  type="button"
                  className="w-full rounded-2xl py-2 text-sm font-medium transition hover:opacity-90"
                  style={{ background: "var(--accent)", color: "#0a0f1e" }}
                >
                  Fork & run →
                </button>
              </div>
            </aside>
          </div>
        </section>

        <footer
          className="mt-10 flex flex-col justify-between gap-3 border-t pt-6 text-[11px] lg:flex-row"
          style={{ borderColor: "var(--border)", color: "rgba(169,183,230,0.6)" }}
        >
          <div>KI-OS Decision Theater · AGPL-3.0 · ki-os.org</div>
          <div>This replay was redacted at source. No prompts, PII, or secrets are stored on the relay.</div>
        </footer>
      </div>
    </div>
  );
}
