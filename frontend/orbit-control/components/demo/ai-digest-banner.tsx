"use client";

import { useState, useEffect } from "react";
import { Sparkles, Rss, Play, X, ExternalLink, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface NewsItem {
  title: string;
  link: string;
  pubDate: string;
  description: string;
  source: string;
}

interface NewsSource {
  source: string;
  color: string;
  items: NewsItem[];
  error: string | null;
}

interface Digest {
  createdAt: string;
  sources: NewsSource[];
  totalArticles: number;
  summary: string | null;
  hasLLM: boolean;
}

interface StarterState {
  active: boolean;
  lastDigest: Digest | null;
  lastRun: string | null;
}

const SOURCE_COLORS: Record<string, string> = {
  "TechCrunch AI":        "bg-sky-500/20 text-sky-300 border-sky-500/30",
  "The Verge AI":         "bg-violet-500/20 text-violet-300 border-violet-500/30",
  "MIT Technology Review":"bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
};

export function AIDigestBanner() {
  const [state, setState]           = useState<StarterState | null>(null);
  const [running, setRunning]       = useState(false);
  const [expanded, setExpanded]     = useState(false);
  const [dismissed, setDismissed]   = useState(false);
  const [error, setError]           = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/starter/status")
      .then(r => r.json())
      .then(setState)
      .catch(() => setState({ active: false, lastDigest: null, lastRun: null }));
  }, []);

  if (!state || !state.active || dismissed) return null;

  async function runDigest() {
    setRunning(true);
    setError(null);
    try {
      const res  = await fetch("/api/starter/news/run", { method: "POST" });
      const data = await res.json();
      if (data.success && data.digest) {
        setState(prev => prev ? { ...prev, lastDigest: data.digest, lastRun: data.digest.createdAt } : prev);
        setExpanded(true);
      } else {
        setError("Abruf fehlgeschlagen — Backend erreichbar?");
      }
    } catch {
      setError("Netzwerkfehler — läuft das Backend auf Port 3000?");
    } finally {
      setRunning(false);
    }
  }

  async function dismiss() {
    setDismissed(true);
    await fetch("/api/starter/dismiss", { method: "DELETE" }).catch(() => {});
  }

  const digest    = state.lastDigest;
  const allItems  = digest?.sources.flatMap(s => s.items.map(i => ({ ...i, source: s.source }))) ?? [];
  const hasResult = !!digest;

  return (
    <section className="rounded-[24px] border border-white/10 bg-gradient-to-br from-[#0a1628]/80 to-[#0d1f3c]/60 p-5 backdrop-blur md:p-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-500/20 text-sky-400">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-white">KI-OS Starter — Täglicher AI-Digest</h3>
              <Badge className="text-[10px] bg-sky-500/20 text-sky-300 border-sky-500/30 py-0">Demo</Badge>
            </div>
            <p className="text-xs text-white/50 mt-0.5">
              Holt AI-News aus 3 Portalen und fasst sie zusammen — echte Daten, kein Mockup.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {hasResult && (
            <button
              onClick={() => setExpanded(e => !e)}
              className="flex items-center gap-1 text-xs text-white/40 hover:text-white/70 transition-colors"
            >
              {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              {expanded ? "Einklappen" : "Ergebnis anzeigen"}
            </button>
          )}
          <button
            onClick={dismiss}
            className="rounded-lg p-1.5 text-white/30 hover:bg-white/10 hover:text-white/70 transition-colors"
            title="Demo schließen"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Quellen-Badges */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Rss className="h-3.5 w-3.5 text-white/30" />
        {["TechCrunch AI", "The Verge AI", "MIT Technology Review"].map(src => (
          <Badge key={src} className={`text-[10px] border py-0 ${SOURCE_COLORS[src] ?? "bg-white/10 text-white/60"}`}>
            {src}
          </Badge>
        ))}
        <span className="text-xs text-white/30">· Kein API-Key nötig für Headlines</span>
      </div>

      {/* CTA */}
      {!hasResult && (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button
            size="sm"
            onClick={runDigest}
            disabled={running}
            className="bg-sky-600 hover:bg-sky-500 text-white gap-2"
          >
            {running
              ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Abruf läuft…</>
              : <><Play className="h-3.5 w-3.5" /> Digest jetzt abrufen</>
            }
          </Button>
          <button
            onClick={dismiss}
            className="text-xs text-white/40 hover:text-white/70 underline underline-offset-2 transition-colors"
          >
            Eigenes System aufbauen →
          </button>
        </div>
      )}

      {hasResult && !expanded && (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <div className="text-xs text-white/50">
            {digest!.totalArticles} Artikel aus {digest!.sources.filter(s => s.items.length > 0).length} Quellen
            {digest!.hasLLM && <span className="ml-2 text-sky-400">· KI-Zusammenfassung verfügbar</span>}
          </div>
          <Button size="sm" variant="outline" onClick={runDigest} disabled={running} className="h-7 text-xs gap-1.5">
            {running ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
            Aktualisieren
          </Button>
          <button
            onClick={dismiss}
            className="text-xs text-white/40 hover:text-white/70 underline underline-offset-2 transition-colors"
          >
            Eigenes System aufbauen →
          </button>
        </div>
      )}

      {error && (
        <p className="mt-3 text-xs text-red-400">{error}</p>
      )}

      {/* Ergebnis */}
      {hasResult && expanded && (
        <div className="mt-5 space-y-4">
          {/* LLM-Zusammenfassung */}
          {digest!.summary && (
            <div className="rounded-xl border border-sky-500/20 bg-sky-500/5 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="h-3.5 w-3.5 text-sky-400" />
                <span className="text-xs font-medium text-sky-300">KI-Zusammenfassung</span>
              </div>
              <p className="text-sm text-white/80 leading-relaxed">{digest!.summary}</p>
            </div>
          )}

          {/* Headlines nach Quelle */}
          <div className="grid gap-3 sm:grid-cols-3">
            {digest!.sources.map(src => (
              <div key={src.source} className="space-y-2">
                <Badge className={`text-[10px] border py-0 ${SOURCE_COLORS[src.source] ?? "bg-white/10 text-white/60"}`}>
                  {src.source}
                </Badge>
                {src.error ? (
                  <p className="text-xs text-red-400/70">Fehler: {src.error}</p>
                ) : src.items.length === 0 ? (
                  <p className="text-xs text-white/30">Keine Artikel heute</p>
                ) : (
                  <ul className="space-y-1.5">
                    {src.items.map((item, i) => (
                      <li key={i}>
                        <a
                          href={item.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group flex items-start gap-1.5 text-xs text-white/60 hover:text-white/90 transition-colors"
                        >
                          <ExternalLink className="mt-0.5 h-3 w-3 shrink-0 opacity-50 group-hover:opacity-100" />
                          <span className="leading-snug line-clamp-2">{item.title}</span>
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-white/5">
            <span className="text-xs text-white/30">
              Abgerufen: {new Date(digest!.createdAt).toLocaleString("de-DE")}
              {!digest!.hasLLM && " · Für KI-Zusammenfassung API-Key in .env setzen"}
            </span>
            <div className="flex items-center gap-3">
              <Button size="sm" variant="outline" onClick={runDigest} disabled={running} className="h-7 text-xs gap-1.5">
                {running ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
                Aktualisieren
              </Button>
              <button
                onClick={dismiss}
                className="text-xs text-white/40 hover:text-white/70 underline underline-offset-2 transition-colors"
              >
                Eigenes System aufbauen →
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
