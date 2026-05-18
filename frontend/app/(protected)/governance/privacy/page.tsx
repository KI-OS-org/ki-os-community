"use client";

import { useState } from "react";
import { Lock, Loader2, AlertTriangle, CheckCircle, Eye, EyeOff, RotateCcw, ChevronLeft } from "lucide-react";
import Link from "next/link";

// ── Types ──────────────────────────────────────────────────────────────────

type PiiEntry = { type: string; value: string; start: number; end: number };
type AnalyzeResult = { text: string; total: number; types: string[]; entities: PiiEntry[] };
type MaskResult    = { original: string; masked: string; total: number; types: string[] };
type DemaskResult  = { masked: string; restored: string };

type Mode = "analyze" | "mask" | "demask";

// ── Component ──────────────────────────────────────────────────────────────

export default function GovernancePrivacyPage() {
  const [mode,    setMode]    = useState<Mode>("analyze");
  const [text,    setText]    = useState("");
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const [analyzeResult, setAnalyzeResult] = useState<AnalyzeResult | null>(null);
  const [maskResult,    setMaskResult]    = useState<MaskResult    | null>(null);
  const [demaskResult,  setDemaskResult]  = useState<DemaskResult  | null>(null);

  async function run() {
    if (!text.trim()) return;
    setLoading(true);
    setError(null);
    setAnalyzeResult(null);
    setMaskResult(null);
    setDemaskResult(null);

    try {
      const res  = await fetch(`/api/privacy?action=${mode}`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Fehler");

      if (mode === "analyze") setAnalyzeResult(data);
      if (mode === "mask")    setMaskResult(data);
      if (mode === "demask")  setDemaskResult(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unbekannter Fehler");
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setText("");
    setAnalyzeResult(null);
    setMaskResult(null);
    setDemaskResult(null);
    setError(null);
  }

  const inputCls = "w-full bg-[#0d1117] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#5ac4ff]/50 transition-colors";
  const labelCls = "block text-xs text-gray-400 mb-1.5 font-medium";

  const MODES: { id: Mode; label: string; icon: React.ElementType; desc: string }[] = [
    { id: "analyze", label: "Analysieren", icon: Eye,     desc: "PII erkennen und klassifizieren" },
    { id: "mask",    label: "Maskieren",   icon: EyeOff,  desc: "PII durch Platzhalter ersetzen" },
    { id: "demask",  label: "De-Maskieren",icon: Eye,     desc: "Maskierten Text wiederherstellen" },
  ];

  return (
    <div className="min-h-screen bg-[#0d1117] text-white p-6">
      <div className="max-w-3xl mx-auto space-y-6">

        {/* Back */}
        <Link href="/governance" className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors">
          <ChevronLeft size={15} /> Governance Studio
        </Link>

        {/* Header */}
        <div className="flex items-center gap-3">
          <Lock className="text-[#5ac4ff]" size={26} />
          <div>
            <h1 className="text-xl font-bold">Privacy Panel</h1>
            <p className="text-sm text-gray-400">PII-Erkennung, Maskierung und Wiederherstellung</p>
          </div>
        </div>

        {/* Info */}
        <div className="flex items-start gap-2 px-4 py-3 rounded-xl border border-[#5ac4ff]/20 bg-[#5ac4ff]/5 text-[#5ac4ff]/80 text-xs">
          <AlertTriangle size={13} className="mt-0.5 shrink-0" />
          <span>Text wird lokal im Backend verarbeitet. Keine Weitergabe an externe Dienste.</span>
        </div>

        {/* Mode */}
        <div className="grid grid-cols-3 gap-3">
          {MODES.map(m => {
            const Icon = m.icon;
            return (
              <button
                key={m.id}
                onClick={() => { setMode(m.id); reset(); }}
                className={`flex flex-col items-start p-4 rounded-xl border text-left transition-colors ${
                  mode === m.id
                    ? "bg-[#5ac4ff]/10 border-[#5ac4ff]/40"
                    : "border-white/10 bg-white/5 hover:border-white/20"
                }`}
              >
                <Icon size={16} className={mode === m.id ? "text-[#5ac4ff] mb-2" : "text-gray-500 mb-2"} />
                <div className={`text-sm font-medium ${mode === m.id ? "text-[#5ac4ff]" : "text-gray-300"}`}>{m.label}</div>
                <div className="text-xs text-gray-500 mt-0.5">{m.desc}</div>
              </button>
            );
          })}
        </div>

        {/* Input */}
        <div className="rounded-xl border border-white/10 bg-white/5 p-5 space-y-4">
          <div>
            <label className={labelCls}>
              {mode === "demask" ? "Maskierter Text" : "Text"}
            </label>
            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              rows={5}
              placeholder={
                mode === "analyze" ? "z.B. Mein Name ist Max Mustermann, max@example.com, Tel: 089-123456..." :
                mode === "mask"    ? "z.B. Kundendaten: Anna Schmidt, Kundennr. 12345, DE89 3704..." :
                                     "z.B. Hallo [NAME_1], deine E-Mail [EMAIL_1] wurde bestätigt..."
              }
              className={inputCls + " resize-none"}
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-400 text-xs">
              <AlertTriangle size={12} /> {error}
            </div>
          )}

          <div className="flex justify-between">
            <button onClick={reset} className="flex items-center gap-2 px-4 py-2 rounded-xl border border-white/10 text-gray-400 text-sm hover:text-white transition-colors">
              <RotateCcw size={13} /> Zurücksetzen
            </button>
            <button
              onClick={run}
              disabled={!text.trim() || loading}
              className="flex items-center gap-2 px-5 py-2 rounded-xl bg-[#5ac4ff]/20 border border-[#5ac4ff]/30 text-[#5ac4ff] text-sm font-medium hover:bg-[#5ac4ff]/30 transition-colors disabled:opacity-40"
            >
              {loading ? <Loader2 className="animate-spin" size={14} /> : <Lock size={14} />}
              {loading ? "Verarbeite..." : MODES.find(m => m.id === mode)?.label}
            </button>
          </div>
        </div>

        {/* Results — Analyze */}
        {analyzeResult && (
          <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-5 space-y-4">
            <div className="flex items-center gap-2 text-green-400 text-sm font-medium">
              <CheckCircle size={14} />
              {analyzeResult.total > 0 ? `${analyzeResult.total} PII-Elemente gefunden` : "Kein PII erkannt"}
            </div>
            {analyzeResult.total > 0 && (
              <>
                <div className="flex flex-wrap gap-2">
                  {analyzeResult.types.map(t => (
                    <span key={t} className="px-2 py-0.5 rounded-full text-xs bg-yellow-500/10 border border-yellow-500/20 text-yellow-400">{t}</span>
                  ))}
                </div>
                <div className="space-y-1.5">
                  {analyzeResult.entities.map((e, i) => (
                    <div key={i} className="flex items-center gap-3 text-xs">
                      <span className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-gray-400 w-24 shrink-0">{e.type}</span>
                      <span className="font-mono text-white">{e.value}</span>
                      <span className="text-gray-600">Pos. {e.start}–{e.end}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* Results — Mask */}
        {maskResult && (
          <div className="rounded-xl border border-[#5ac4ff]/20 bg-[#5ac4ff]/5 p-5 space-y-3">
            <div className="text-sm font-medium text-[#5ac4ff]">{maskResult.total} PII maskiert</div>
            <div>
              <div className={labelCls}>Maskierter Text</div>
              <pre className="text-sm text-gray-200 whitespace-pre-wrap font-mono bg-black/30 rounded-xl p-3 text-xs leading-relaxed">{maskResult.masked}</pre>
            </div>
            <div className="flex flex-wrap gap-2">
              {maskResult.types.map(t => (
                <span key={t} className="px-2 py-0.5 rounded-full text-xs bg-yellow-500/10 border border-yellow-500/20 text-yellow-400">{t}</span>
              ))}
            </div>
          </div>
        )}

        {/* Results — Demask */}
        {demaskResult && (
          <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-5 space-y-3">
            <div className="text-sm font-medium text-green-400">Text wiederhergestellt</div>
            <div>
              <div className={labelCls}>Wiederhergestellter Text</div>
              <pre className="text-sm text-gray-200 whitespace-pre-wrap font-mono bg-black/30 rounded-xl p-3 text-xs leading-relaxed">{demaskResult.restored}</pre>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
