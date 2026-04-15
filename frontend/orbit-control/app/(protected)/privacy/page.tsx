"use client";

import { useState } from "react";
import { ShieldCheck, Eye, EyeOff, Unlock, RefreshCw, Copy, Check } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface PiiEntity {
  type: string;
  value: string;
  count?: number;
}

interface AnalyzeResult {
  detected: PiiEntity[];
  totalCount: number;
  maskedPreview?: string;
}

interface MaskResult {
  masked: string;
  sessionId?: string;
  replacements?: number;
}

interface DemaskResult {
  original: string;
}

type Tab = "analyze" | "mask" | "demask";

// ── Helpers ───────────────────────────────────────────────────────────────────

const piiColors: Record<string, string> = {
  EMAIL:   "#5ac4ff",
  PHONE:   "#22c55e",
  NAME:    "#eab308",
  ADDRESS: "#a78bfa",
  SSN:     "#f87171",
  CREDIT:  "#f87171",
  DATE:    "#fb923c",
};

function piiColor(type: string) {
  return piiColors[type.toUpperCase()] ?? "#94a3b8";
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <button
      onClick={copy}
      className="flex items-center gap-1 rounded px-2 py-1 text-xs transition-colors"
      style={{ color: copied ? "#22c55e" : "var(--muted-foreground)", background: "rgba(255,255,255,0.05)" }}
    >
      {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
      {copied ? "Kopiert" : "Kopieren"}
    </button>
  );
}

// ── Tabs ──────────────────────────────────────────────────────────────────────

function AnalyzeTab() {
  const [text, setText] = useState("");
  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    if (!text.trim()) return;
    setLoading(true); setError(null); setResult(null);
    try {
      const res = await fetch("/api/privacy?action=analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message ?? "Fehler");
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unbekannter Fehler");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1.5">
          Text zur Analyse
        </label>
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Text mit potenziellen PII-Daten eingeben..."
          rows={6}
          className="w-full rounded-xl px-4 py-3 text-sm resize-none outline-none transition-colors"
          style={{
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.1)",
            color: "var(--foreground)",
          }}
        />
      </div>

      <button
        onClick={run}
        disabled={loading || !text.trim()}
        className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-opacity disabled:opacity-50"
        style={{ background: "rgba(90,196,255,0.15)", border: "1px solid rgba(90,196,255,0.3)", color: "#5ac4ff" }}
      >
        {loading ? <RefreshCw className="size-4 animate-spin" /> : <Eye className="size-4" />}
        {loading ? "Analysiere…" : "Analysieren"}
      </button>

      {error && (
        <div className="rounded-xl px-4 py-3 text-sm" style={{ background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.25)", color: "#f87171" }}>
          {error}
        </div>
      )}

      {result && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="rounded-xl p-4 text-center" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <p className="text-2xl font-bold" style={{ color: "#5ac4ff" }}>{result.totalCount ?? result.detected?.length ?? 0}</p>
              <p className="text-xs text-[var(--muted-foreground)] mt-0.5">PII gefunden</p>
            </div>
            <div className="rounded-xl p-4 text-center" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <p className="text-2xl font-bold" style={{ color: "#22c55e" }}>{new Set(result.detected?.map(d => d.type)).size}</p>
              <p className="text-xs text-[var(--muted-foreground)] mt-0.5">PII-Typen</p>
            </div>
          </div>

          {(result.detected?.length ?? 0) > 0 && (
            <div className="rounded-xl p-4 space-y-2" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <p className="text-xs font-medium text-[var(--muted-foreground)] mb-3">Erkannte Entitäten</p>
              <div className="flex flex-wrap gap-2">
                {result.detected.map((d, i) => (
                  <span
                    key={i}
                    className="rounded-full px-2.5 py-1 text-xs font-medium"
                    style={{
                      background: `${piiColor(d.type)}18`,
                      border: `1px solid ${piiColor(d.type)}40`,
                      color: piiColor(d.type),
                    }}
                  >
                    {d.type}{d.count ? ` ×${d.count}` : ""}{d.value ? `: ${d.value.slice(0, 20)}` : ""}
                  </span>
                ))}
              </div>
            </div>
          )}

          {result.maskedPreview && (
            <div className="rounded-xl p-4" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-[var(--muted-foreground)]">Masked Preview</p>
                <CopyButton text={result.maskedPreview} />
              </div>
              <pre className="text-sm text-[var(--foreground)] whitespace-pre-wrap break-all">{result.maskedPreview}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MaskTab() {
  const [text, setText] = useState("");
  const [maskLevel, setMaskLevel] = useState("standard");
  const [result, setResult] = useState<MaskResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    if (!text.trim()) return;
    setLoading(true); setError(null); setResult(null);
    try {
      const res = await fetch("/api/privacy?action=mask", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text, maskLevel }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message ?? "Fehler");
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unbekannter Fehler");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1.5">Text maskieren</label>
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Text mit PII eingeben…"
            rows={6}
            className="w-full rounded-xl px-4 py-3 text-sm resize-none outline-none"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "var(--foreground)" }}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1.5">Mask-Level</label>
          <select
            value={maskLevel}
            onChange={e => setMaskLevel(e.target.value)}
            className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "var(--foreground)" }}
          >
            <option value="standard">Standard</option>
            <option value="strict">Strict</option>
          </select>
          <p className="text-xs text-[var(--muted-foreground)] mt-2">
            {maskLevel === "strict" ? "Alle erkannten Daten werden vollständig entfernt." : "PII wird durch Platzhalter ersetzt."}
          </p>
        </div>
      </div>

      <button
        onClick={run}
        disabled={loading || !text.trim()}
        className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-opacity disabled:opacity-50"
        style={{ background: "rgba(90,196,255,0.15)", border: "1px solid rgba(90,196,255,0.3)", color: "#5ac4ff" }}
      >
        {loading ? <RefreshCw className="size-4 animate-spin" /> : <EyeOff className="size-4" />}
        {loading ? "Maskiere…" : "Maskieren"}
      </button>

      {error && (
        <div className="rounded-xl px-4 py-3 text-sm" style={{ background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.25)", color: "#f87171" }}>
          {error}
        </div>
      )}

      {result && (
        <div className="space-y-3">
          {result.sessionId && (
            <div className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm" style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)" }}>
              <Check className="size-4" style={{ color: "#22c55e" }} />
              <span className="text-[var(--muted-foreground)]">Session-ID:</span>
              <code className="text-[var(--foreground)] font-mono text-xs">{result.sessionId}</code>
              <CopyButton text={result.sessionId} />
            </div>
          )}
          <div className="rounded-xl p-4" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-[var(--muted-foreground)]">
                Maskierter Text {result.replacements != null ? `(${result.replacements} Ersetzungen)` : ""}
              </p>
              <CopyButton text={result.masked} />
            </div>
            <pre className="text-sm text-[var(--foreground)] whitespace-pre-wrap break-all">{result.masked}</pre>
          </div>
        </div>
      )}
    </div>
  );
}

function DemaskTab() {
  const [maskedText, setMaskedText] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [result, setResult] = useState<DemaskResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    if (!maskedText.trim() || !sessionId.trim()) return;
    setLoading(true); setError(null); setResult(null);
    try {
      const res = await fetch("/api/privacy?action=demask", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ maskedText, sessionId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message ?? "Fehler");
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unbekannter Fehler");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1.5">Session-ID</label>
        <input
          type="text"
          value={sessionId}
          onChange={e => setSessionId(e.target.value)}
          placeholder="Session-ID aus dem Mask-Schritt…"
          className="w-full rounded-xl px-4 py-2.5 text-sm outline-none font-mono"
          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "var(--foreground)" }}
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1.5">Maskierter Text</label>
        <textarea
          value={maskedText}
          onChange={e => setMaskedText(e.target.value)}
          placeholder="Maskierten Text hier einfügen…"
          rows={6}
          className="w-full rounded-xl px-4 py-3 text-sm resize-none outline-none"
          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "var(--foreground)" }}
        />
      </div>

      <button
        onClick={run}
        disabled={loading || !maskedText.trim() || !sessionId.trim()}
        className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-opacity disabled:opacity-50"
        style={{ background: "rgba(90,196,255,0.15)", border: "1px solid rgba(90,196,255,0.3)", color: "#5ac4ff" }}
      >
        {loading ? <RefreshCw className="size-4 animate-spin" /> : <Unlock className="size-4" />}
        {loading ? "Demaskiere…" : "De-Maskieren"}
      </button>

      {error && (
        <div className="rounded-xl px-4 py-3 text-sm" style={{ background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.25)", color: "#f87171" }}>
          {error}
        </div>
      )}

      {result && (
        <div className="rounded-xl p-4" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium text-[var(--muted-foreground)]">Original Text</p>
            <CopyButton text={result.original} />
          </div>
          <pre className="text-sm text-[var(--foreground)] whitespace-pre-wrap break-all">{result.original}</pre>
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "analyze", label: "Analyze",  icon: <Eye className="size-4" /> },
  { id: "mask",    label: "Mask",     icon: <EyeOff className="size-4" /> },
  { id: "demask",  label: "De-Mask",  icon: <Unlock className="size-4" /> },
];

export default function PrivacyPage() {
  const [tab, setTab] = useState<Tab>("analyze");

  return (
    <div className="space-y-5 p-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--foreground)] flex items-center gap-2">
          <ShieldCheck className="size-6" style={{ color: "var(--accent)" }} />
          Privacy Guard
        </h1>
        <p className="text-sm text-[var(--muted-foreground)] mt-1">
          PII erkennen, maskieren und de-maskieren — lokal und sicher
        </p>
      </div>

      {/* Tab Bar */}
      <div className="flex gap-1 rounded-xl p-1" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", width: "fit-content" }}>
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors"
            style={tab === t.id
              ? { background: "rgba(90,196,255,0.15)", border: "1px solid rgba(90,196,255,0.3)", color: "#5ac4ff" }
              : { color: "var(--muted-foreground)" }}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="glass-card p-5">
        {tab === "analyze" && <AnalyzeTab />}
        {tab === "mask"    && <MaskTab />}
        {tab === "demask"  && <DemaskTab />}
      </div>
    </div>
  );
}
