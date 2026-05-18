"use client";

import { useState, useEffect } from "react";
import { Database, RefreshCw, Download, Upload, Server, CheckCircle2, AlertCircle } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Backend {
  id: string;
  name: string;
  type?: string;
  health: string;
  latencyMs?: number;
  size?: string | number;
}

interface ImportResult {
  success: boolean;
  message?: string;
  imported?: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function healthColor(h: string) {
  if (h === "healthy" || h === "ok") return "#22c55e";
  if (h === "degraded") return "#eab308";
  return "#f87171";
}

function JsonTree({ data, depth = 0 }: { data: unknown; depth?: number }) {
  if (data === null || data === undefined) {
    return <span className="text-[#94a3b8]">null</span>;
  }
  if (typeof data === "boolean") {
    return <span style={{ color: "#f87171" }}>{String(data)}</span>;
  }
  if (typeof data === "number") {
    return <span style={{ color: "#5ac4ff" }}>{data}</span>;
  }
  if (typeof data === "string") {
    return <span style={{ color: "#22c55e" }}>"{data}"</span>;
  }
  if (Array.isArray(data)) {
    if (data.length === 0) return <span className="text-[var(--muted-foreground)]">[]</span>;
    return (
      <span>
        {"["}
        <div style={{ marginLeft: `${(depth + 1) * 16}px` }}>
          {data.map((item, i) => (
            <div key={i}>
              <JsonTree data={item} depth={depth + 1} />
              {i < data.length - 1 && <span className="text-[var(--muted-foreground)]">,</span>}
            </div>
          ))}
        </div>
        {"]"}
      </span>
    );
  }
  if (typeof data === "object") {
    const entries = Object.entries(data as Record<string, unknown>);
    if (entries.length === 0) return <span className="text-[var(--muted-foreground)]">{"{}"}</span>;
    return (
      <span>
        {"{"}
        <div style={{ marginLeft: `${(depth + 1) * 16}px` }}>
          {entries.map(([k, v], i) => (
            <div key={k}>
              <span style={{ color: "#a78bfa" }}>"{k}"</span>
              <span className="text-[var(--muted-foreground)]">: </span>
              <JsonTree data={v} depth={depth + 1} />
              {i < entries.length - 1 && <span className="text-[var(--muted-foreground)]">,</span>}
            </div>
          ))}
        </div>
        {"}"}
      </span>
    );
  }
  return <span>{String(data)}</span>;
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function StatePage() {
  const [fabric,     setFabric]     = useState<unknown>(null);
  const [backends,   setBackends]   = useState<Backend[]>([]);
  const [exportData, setExportData] = useState<unknown>(null);
  const [importText, setImportText] = useState("");
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [exporting,  setExporting]  = useState(false);
  const [importing,  setImporting]  = useState(false);

  const fetchFabric   = () => fetch("/api/state?section=fabric").then(r => r.json()).catch(() => null);
  const fetchBackends = () => fetch("/api/state?section=backends").then(r => r.json()).catch(() => []);

  useEffect(() => {
    Promise.all([fetchFabric(), fetchBackends()])
      .then(([f, b]) => {
        setFabric(f);
        setBackends(Array.isArray(b) ? b : (b?.backends ?? []));
      })
      .finally(() => setLoading(false));
  }, []);

  const doExport = async () => {
    setExporting(true);
    try {
      const res = await fetch("/api/state?section=export");
      const data = await res.json().catch(() => null);
      setExportData(data);
    } finally { setExporting(false); }
  };

  const downloadExport = () => {
    if (!exportData) return;
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "state-export.json"; a.click();
    URL.revokeObjectURL(url);
  };

  const doImport = async () => {
    if (!importText.trim()) return;
    setImporting(true); setImportResult(null);
    try {
      let parsed;
      try {
        parsed = JSON.parse(importText);
      } catch {
        setImportResult({ success: false, message: "Ungültiges JSON — bitte gültiges JSON eingeben." });
        setImporting(false);
        return;
      }
      const res = await fetch("/api/state", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(parsed),
      });
      const data = await res.json();
      setImportResult({ success: res.ok, message: data?.message, imported: data?.imported });
    } catch (e) {
      setImportResult({ success: false, message: e instanceof Error ? e.message : "Fehler" });
    } finally { setImporting(false); }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <RefreshCw className="size-6 animate-spin" style={{ color: "var(--accent)" }} />
      </div>
    );
  }

  return (
    <div className="space-y-5 p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[var(--foreground)] flex items-center gap-2">
          <Database className="size-6" style={{ color: "var(--accent)" }} />
          State Management
        </h1>
        <p className="text-sm text-[var(--muted-foreground)] mt-1">
          State Fabric, Export/Import und Storage-Backends
        </p>
      </div>

      {/* Backends */}
      {backends.length > 0 && (
        <div className="glass-card p-5">
          <h3 className="font-semibold text-[var(--foreground)] flex items-center gap-2 mb-4">
            <Server className="size-4" style={{ color: "var(--accent)" }} />
            Storage Backends
          </h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {backends.map(b => (
              <div key={b.id} className="rounded-xl p-3.5 flex items-start gap-3" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <div className="size-2 rounded-full mt-1.5 shrink-0" style={{ background: healthColor(b.health) }} />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[var(--foreground)] truncate">{b.name}</p>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                    {b.type && <span className="text-xs text-[var(--muted-foreground)]">{b.type}</span>}
                    <span className="text-xs font-medium" style={{ color: healthColor(b.health) }}>{b.health}</span>
                    {b.latencyMs != null && <span className="text-xs text-[var(--muted-foreground)]">{b.latencyMs}ms</span>}
                    {b.size != null && <span className="text-xs text-[var(--muted-foreground)]">{b.size}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Grid */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* State Fabric */}
        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-[var(--foreground)] flex items-center gap-2">
              <Database className="size-4" style={{ color: "var(--accent)" }} />
              State Fabric
            </h3>
            <button
              onClick={() => fetchFabric().then(setFabric)}
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs"
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "var(--muted-foreground)" }}
            >
              <RefreshCw className="size-3" /> Refresh
            </button>
          </div>
          <div
            className="rounded-xl p-4 overflow-auto max-h-96 text-xs font-mono leading-relaxed"
            style={{ background: "rgba(0,0,0,0.25)", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            {fabric != null ? <JsonTree data={fabric} /> : <span className="text-[var(--muted-foreground)]">Keine Daten</span>}
          </div>
        </div>

        {/* Export / Import */}
        <div className="space-y-4">
          {/* Export */}
          <div className="glass-card p-5">
            <h3 className="font-semibold text-[var(--foreground)] flex items-center gap-2 mb-4">
              <Download className="size-4" style={{ color: "var(--accent)" }} />
              Export
            </h3>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={doExport}
                disabled={exporting}
                className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-opacity disabled:opacity-50"
                style={{ background: "rgba(90,196,255,0.12)", border: "1px solid rgba(90,196,255,0.25)", color: "#5ac4ff" }}
              >
                {exporting ? <RefreshCw className="size-4 animate-spin" /> : <Download className="size-4" />}
                {exporting ? "Exportiere…" : "State exportieren"}
              </button>
              {exportData && (
                <button
                  onClick={downloadExport}
                  className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium"
                  style={{ background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.25)", color: "#22c55e" }}
                >
                  <Download className="size-4" /> Download JSON
                </button>
              )}
            </div>
            {exportData && (
              <div
                className="mt-3 rounded-xl p-3 overflow-auto max-h-48 text-xs font-mono leading-relaxed"
                style={{ background: "rgba(0,0,0,0.25)", border: "1px solid rgba(255,255,255,0.08)" }}
              >
                <JsonTree data={exportData} />
              </div>
            )}
          </div>

          {/* Import */}
          <div className="glass-card p-5">
            <h3 className="font-semibold text-[var(--foreground)] flex items-center gap-2 mb-4">
              <Upload className="size-4" style={{ color: "var(--accent)" }} />
              Import
            </h3>
            <textarea
              value={importText}
              onChange={e => setImportText(e.target.value)}
              placeholder='{"state": {...}} — State-JSON hier einfügen…'
              rows={5}
              className="w-full rounded-xl px-4 py-3 text-sm resize-none outline-none font-mono"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "var(--foreground)" }}
            />
            <button
              onClick={doImport}
              disabled={importing || !importText.trim()}
              className="mt-3 flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-opacity disabled:opacity-50"
              style={{ background: "rgba(90,196,255,0.12)", border: "1px solid rgba(90,196,255,0.25)", color: "#5ac4ff" }}
            >
              {importing ? <RefreshCw className="size-4 animate-spin" /> : <Upload className="size-4" />}
              {importing ? "Importiere…" : "Importieren"}
            </button>

            {importResult && (
              <div
                className="mt-3 flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm"
                style={importResult.success
                  ? { background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)" }
                  : { background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)" }}
              >
                {importResult.success
                  ? <CheckCircle2 className="size-4 shrink-0" style={{ color: "#22c55e" }} />
                  : <AlertCircle  className="size-4 shrink-0" style={{ color: "#f87171" }} />}
                <span style={{ color: importResult.success ? "#22c55e" : "#f87171" }}>
                  {importResult.message ?? (importResult.success ? "Import erfolgreich" : "Import fehlgeschlagen")}
                  {importResult.imported != null ? ` (${importResult.imported} Einträge)` : ""}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
