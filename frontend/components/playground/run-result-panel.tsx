/**
 * (c) 2026 KI-OS.org by Ingo Schaffer und Kimba
 * License: AGPL-3.0-only (Community) / Proprietär (Enterprise)
 * @desc Run Result Panel — Zeigt das Ergebnis eines Playground-Runs mit Steps und Share-Option
 */

"use client";

import { useState } from "react";
import { CheckCircle, Clock, Copy, Loader2, Share2 } from "lucide-react";
import type { RunResult, RunStep } from "./playground-shell";

const STEP_COLORS: Record<string, string> = {
  reasoning: "var(--accent-purple)",
  tool: "var(--accent-green)",
  output: "var(--foreground)",
  route: "var(--accent-orange)",
  policy: "var(--accent-red)",
  memory: "var(--accent-blue)",
};

function fmtDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

export function RunResultPanel({ result }: { result: RunResult }) {
  const [sharing, setSharing] = useState(false);
  const [shareLink, setShareLink] = useState<string | null>(null);

  const statusColor =
    result.status.toLowerCase() === "completed"
      ? "var(--accent-green)"
      : "var(--accent-orange)";

  const handleShare = async () => {
    setSharing(true);
    try {
      const res = await fetch("/api/theater/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runId: result.runId }),
      });
      if (res.ok) {
        const data: unknown = await res.json();
        const link =
          (data as { link?: string; url?: string }).link ??
          (data as { link?: string; url?: string }).url ??
          null;
        if (link) setShareLink(link);
      }
    } catch {
      // silent fail
    } finally {
      setSharing(false);
    }
  };

  const handleCopyLink = async () => {
    if (shareLink) {
      await navigator.clipboard.writeText(shareLink);
    }
  };

  return (
    <div className="rounded-[24px] border border-white/10 bg-black/20 p-5 backdrop-blur">
      {/* Header */}
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3
            className="truncate text-sm font-semibold"
            style={{ color: "var(--foreground)" }}
          >
            {result.scenarioTitle}
          </h3>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[10px]">
            <span
              className="font-mono"
              style={{ color: "var(--muted-foreground)" }}
            >
              {result.runId}
            </span>
            <span
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5"
              style={{
                backgroundColor: "color-mix(in srgb, var(--accent-green) 10%, transparent)",
                color: "var(--accent-green)",
              }}
            >
              <Clock className="h-2.5 w-2.5" />
              {fmtDuration(result.duration_ms)}
            </span>
          </div>
        </div>

        <span
          className="shrink-0 rounded-full px-2.5 py-1 text-[10px] uppercase tracking-[0.12em] font-semibold"
          style={{
            backgroundColor: "color-mix(in srgb, var(--accent-green) 10%, transparent)",
            color: statusColor,
            border: "1px solid color-mix(in srgb, var(--accent-green) 25%, transparent)",
          }}
        >
          {result.status}
        </span>
      </div>

      {/* Steps */}
      <div className="space-y-2">
        <p className="text-[10px] uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>
          Ausführungsschritte ({result.steps.length})
        </p>

        <div className="max-h-80 space-y-1.5 overflow-y-auto">
          {result.steps.map((step, index) => {
            const color = STEP_COLORS[step.type.toLowerCase()] ?? "var(--muted-foreground)";
            return (
              <div
                key={index}
                className="flex items-center gap-2 rounded-xl border px-3 py-2 text-xs"
                style={{
                  borderColor: "color-mix(in srgb, var(--border) 60%, transparent)",
                  backgroundColor: "color-mix(in srgb, var(--foreground) 4%, transparent)",
                }}
              >
                <span
                  className="shrink-0 rounded px-1.5 py-0.5 text-[9px] uppercase tracking-[0.1em] font-semibold"
                  style={{
                    backgroundColor: "color-mix(in srgb, var(--border) 15%, transparent)",
                    color: color,
                  }}
                >
                  {step.type}
                </span>
                <span className="truncate" style={{ color: "var(--foreground)" }}>
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Share Button */}
      <div className="mt-4 pt-4 border-t" style={{ borderColor: "var(--border)" }}>
        {shareLink ? (
          <div className="flex items-center gap-2">
            <div
              className="flex-1 truncate rounded-xl px-3 py-2 text-[11px] font-mono"
              style={{
                backgroundColor: "color-mix(in srgb, var(--foreground) 5%, transparent)",
                color: "var(--muted-foreground)",
              }}
            >
              {shareLink}
            </div>
            <button
              type="button"
              onClick={handleCopyLink}
              className="flex items-center justify-center rounded-xl p-2 transition hover:opacity-90"
              style={{
                backgroundColor: "var(--accent-dim)",
                border: "1px solid rgba(90,196,255,0.22)",
                color: "var(--accent)",
              }}
              title="Link kopieren"
            >
              <Copy className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={handleShare}
            disabled={sharing}
            className="flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-medium transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            style={{
              background: "var(--accent-dim)",
              border: "1px solid rgba(90,196,255,0.22)",
              color: "var(--accent)",
            }}
          >
            {sharing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Teile...
              </>
            ) : (
              <>
                <Share2 className="h-4 w-4" />
                Als Theater teilen
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
