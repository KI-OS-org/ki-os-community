"use client";

/**
 * KI-OS · Swarm Memory — Live-Demo
 *
 * Bettet die swarm-memory/index.html als Vollbild-iframe ein.
 * Holt live Einträge + Stats vom Backend alle 5 Sekunden und
 * schickt sie via postMessage in den iframe (type: 'swarm-update').
 *
 * Fallback-Seed: Wenn das Backend nicht erreichbar ist, werden
 * 8 realistische Beispiel-Einträge gezeigt damit die Visualisierung
 * nicht leer bleibt.
 */

import { useEffect, useRef, useCallback } from "react";

// ── Typen ────────────────────────────────────────────────────────────────────

interface SwarmEntry {
  id:                  string;
  text:                string;
  confidence:          number;
  effectiveConfidence: number;
  usageCount:          number;
  metadata?:           { type?: string; author?: string; [k: string]: unknown };
}

interface SwarmStats {
  total:                  number;
  avgConfidence:          number;
  avgEffectiveConfidence: number;
  decayLambda:            number;
  byType?:                Record<string, number>;
}

// ── Fallback-Seed ─────────────────────────────────────────────────────────────

const SEED_ENTRIES: SwarmEntry[] = [
  { id: "seed-01", text: "Lazy-Load-Pattern für optionale AWS SDK Dependencies vermeidet harte Abhängigkeiten in der Community Edition", confidence: 0.85, effectiveConfidence: 0.82, usageCount: 12, metadata: { type: "pattern",  author: "kimba" } },
  { id: "seed-02", text: "LanceDB Adapter: _ensureReady() lazy-init pattern statt async Konstruktor", confidence: 0.80, effectiveConfidence: 0.77, usageCount: 7, metadata: { type: "pattern",  author: "kimba" } },
  { id: "seed-03", text: "ACO-inspirierter Swarm Memory: confidence × e^(-λ×days) = effektive Confidence", confidence: 0.90, effectiveConfidence: 0.88, usageCount: 21, metadata: { type: "decision", author: "ingo"  } },
  { id: "seed-04", text: "Security Gate Default DENY: Nur whitegelistete Skripte und Root-Files passieren", confidence: 0.95, effectiveConfidence: 0.93, usageCount: 33, metadata: { type: "contract", author: "kimba" } },
  { id: "seed-05", text: "OpenRouter API für echte Modell-Calls (Gemini, DeepSeek) — keine Claude-Subagenten als fake Teams", confidence: 0.88, effectiveConfidence: 0.85, usageCount: 15, metadata: { type: "decision", author: "ingo"  } },
  { id: "seed-06", text: "FNV-1a Hash als Mock-Embedding-Fallback wenn OpenAI Key fehlt", confidence: 0.72, effectiveConfidence: 0.68, usageCount: 4,  metadata: { type: "pattern",  author: "gemini" } },
  { id: "seed-07", text: "Node.js built-in test runner (node:test) statt jest/vitest — zero dependencies", confidence: 0.78, effectiveConfidence: 0.75, usageCount: 9,  metadata: { type: "decision", author: "kimba" } },
  { id: "seed-08", text: "postMessage + cancelAnimationFrame on beforeunload verhindert rAF-Leaks in Canvas-Demos", confidence: 0.65, effectiveConfidence: 0.60, usageCount: 3,  metadata: { type: "review",   author: "deepseek" } },
];

const SEED_STATS: SwarmStats = {
  total:                  8,
  avgConfidence:          0.819,
  avgEffectiveConfidence: 0.785,
  decayLambda:            0.05,
  byType:                 { pattern: 3, decision: 3, contract: 1, review: 1 },
};

// ── Hauptseite ────────────────────────────────────────────────────────────────

export default function SwarmMemoryDemoPage() {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const timerRef  = useRef<ReturnType<typeof setInterval> | null>(null);

  const sendToIframe = useCallback((entries: SwarmEntry[], stats: SwarmStats) => {
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) return;
    iframe.contentWindow.postMessage({ type: "swarm-update", entries, stats }, "*");
  }, []);

  const fetchAndSync = useCallback(async () => {
    try {
      const [eRes, sRes] = await Promise.all([
        fetch("/api/swarm/entries?limit=100", { cache: "no-store" }),
        fetch("/api/swarm/stats",             { cache: "no-store" }),
      ]);

      const entries: SwarmEntry[] = eRes.ok ? await eRes.json() : SEED_ENTRIES;
      const stats: SwarmStats     = sRes.ok ? await sRes.json() : SEED_STATS;

      sendToIframe(
        Array.isArray(entries) ? entries : SEED_ENTRIES,
        stats && typeof stats.total === "number" ? stats : SEED_STATS,
      );
    } catch {
      // Backend offline → Fallback-Seed zeigen
      sendToIframe(SEED_ENTRIES, SEED_STATS);
    }
  }, [sendToIframe]);

  const onIframeLoad = useCallback(() => {
    fetchAndSync();
    timerRef.current = setInterval(fetchAndSync, 5_000);
  }, [fetchAndSync]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  return (
    <div
      style={{
        marginTop:    "-1.5rem",
        marginBottom: "-1.5rem",
        height:       "calc(100vh - 9rem)",
        background:   "#0a0a0a",
        borderRadius: "1.5rem",
        overflow:     "hidden",
      }}
    >
      <iframe
        ref={iframeRef}
        src="/simulations/swarm-memory/index.html"
        onLoad={onIframeLoad}
        style={{ width: "100%", height: "100%", border: "none", display: "block" }}
        title="Swarm Memory Live Demo"
        sandbox="allow-scripts allow-same-origin"
      />
    </div>
  );
}
