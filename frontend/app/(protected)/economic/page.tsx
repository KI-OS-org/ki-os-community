"use client";

import { useState, useEffect } from "react";
import { BarChart3, RefreshCw, Play, TrendingUp, CheckCircle2, AlertCircle } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface EconomicProfile {
  id: string;
  name: string;
  description?: string;
  active?: boolean;
  type?: string;
}

interface Scorecard {
  metric: string;
  value: number | string;
  unit?: string;
  trend?: "up" | "down" | "stable";
  status?: "good" | "warn" | "bad";
}

interface Decision {
  id: string;
  timestamp: string;
  profileId?: string;
  decision: string;
  score?: number;
  reason?: string;
}

interface EvaluateResult {
  decision: string;
  score?: number;
  confidence?: number;
  reason?: string;
  recommendation?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleString("de-DE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  } catch { return iso; }
}

function trendColor(t?: string) {
  if (t === "up") return "#22c55e";
  if (t === "down") return "#f87171";
  return "#5ac4ff";
}

function statusIcon(s?: string) {
  if (s === "good") return <CheckCircle2 className="size-3.5" style={{ color: "#22c55e" }} />;
  if (s === "bad")  return <AlertCircle  className="size-3.5" style={{ color: "#f87171" }} />;
  return <TrendingUp className="size-3.5" style={{ color: "#eab308" }} />;
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function EconomicPage() {
  const [profiles,   setProfiles]   = useState<EconomicProfile[]>([]);
  const [scorecards, setScorecards] = useState<Scorecard[]>([]);
  const [decisions,  setDecisions]  = useState<Decision[]>([]);
  const [selected,   setSelected]   = useState<string>("");
  const [inputs,     setInputs]     = useState("");
  const [evalResult, setEvalResult] = useState<EvaluateResult | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [evaluating, setEvaluating] = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  const fetchData = async () => {
    try {
      const [pRes, sRes, dRes] = await Promise.all([
        fetch("/api/economic?section=profiles"),
        fetch("/api/economic?section=scorecards"),
        fetch("/api/economic?section=decisions"),
      ]);
      const pData = await pRes.json().catch(() => []);
      const sData = await sRes.json().catch(() => []);
      const dData = await dRes.json().catch(() => []);

      const pList = Array.isArray(pData) ? pData : (pData.profiles ?? []);
      const sList = Array.isArray(sData) ? sData : (sData.scorecards ?? []);
      const dList = Array.isArray(dData) ? dData : (dData.decisions ?? []);

      setProfiles(pList);
      setScorecards(sList);
      setDecisions(dList);
      if (pList.length > 0 && !selected) setSelected(pList[0].id);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []); // eslint-disable-line

  const evaluate = async () => {
    setEvaluating(true); setError(null); setEvalResult(null);
    try {
      let parsedInputs = {};
      if (inputs.trim()) {
        try { parsedInputs = JSON.parse(inputs); } catch { parsedInputs = { raw: inputs }; }
      }
      const res = await fetch("/api/economic", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ profileId: selected, inputs: parsedInputs }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message ?? "Fehler");
      setEvalResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unbekannter Fehler");
    } finally {
      setEvaluating(false);
    }
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
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)] flex items-center gap-2">
            <BarChart3 className="size-6" style={{ color: "var(--accent)" }} />
            Economic Models
          </h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">
            Profile, Scorecards und Entscheidungsauswertung
          </p>
        </div>
        <button
          onClick={fetchData}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium"
          style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "var(--muted-foreground)" }}
        >
          <RefreshCw className="size-3.5" /> Aktualisieren
        </button>
      </div>

      {/* Scorecards */}
      {scorecards.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {scorecards.slice(0, 8).map((s, i) => (
            <div key={i} className="glass-card p-4 text-center">
              <div className="flex justify-center mb-1">{statusIcon(s.status)}</div>
              <p className="text-xl font-bold" style={{ color: trendColor(s.trend) }}>
                {s.value}{s.unit ? <span className="text-sm ml-0.5">{s.unit}</span> : null}
              </p>
              <p className="text-xs text-[var(--muted-foreground)] mt-0.5">{s.metric}</p>
            </div>
          ))}
        </div>
      )}

      {/* Main Grid */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Profiles panel */}
        <div className="glass-card p-5 space-y-3">
          <h3 className="font-semibold text-[var(--foreground)] flex items-center gap-2">
            <TrendingUp className="size-4" style={{ color: "var(--accent)" }} />
            Profile
          </h3>
          {profiles.length === 0 ? (
            <p className="text-sm text-[var(--muted-foreground)] text-center py-4">Keine Profile verfügbar</p>
          ) : (
            <div className="space-y-2">
              {profiles.map(p => (
                <button
                  key={p.id}
                  onClick={() => setSelected(p.id)}
                  className="w-full text-left rounded-xl px-3 py-2.5 transition-colors"
                  style={selected === p.id
                    ? { background: "rgba(90,196,255,0.12)", border: "1px solid rgba(90,196,255,0.3)" }
                    : { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-[var(--foreground)]">{p.name}</span>
                    {p.active && (
                      <span className="text-xs rounded-full px-2 py-0.5" style={{ background: "rgba(34,197,94,0.12)", color: "#22c55e" }}>
                        Aktiv
                      </span>
                    )}
                  </div>
                  {p.description && <p className="text-xs text-[var(--muted-foreground)] mt-0.5 truncate">{p.description}</p>}
                  {p.type && <p className="text-xs text-[var(--muted-foreground)]">{p.type}</p>}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Evaluate Form */}
        <div className="glass-card p-5 space-y-4 lg:col-span-2">
          <h3 className="font-semibold text-[var(--foreground)] flex items-center gap-2">
            <Play className="size-4" style={{ color: "var(--accent)" }} />
            Evaluate
          </h3>

          <div>
            <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1.5">Profil</label>
            <select
              value={selected}
              onChange={e => setSelected(e.target.value)}
              className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "var(--foreground)" }}
            >
              {profiles.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
              {profiles.length === 0 && <option value="">Kein Profil</option>}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1.5">
              Inputs (JSON oder Freitext)
            </label>
            <textarea
              value={inputs}
              onChange={e => setInputs(e.target.value)}
              placeholder={`{"revenue": 50000, "cost": 30000}`}
              rows={4}
              className="w-full rounded-xl px-4 py-3 text-sm resize-none outline-none font-mono"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "var(--foreground)" }}
            />
          </div>

          <button
            onClick={evaluate}
            disabled={evaluating || !selected}
            className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-opacity disabled:opacity-50"
            style={{ background: "rgba(90,196,255,0.15)", border: "1px solid rgba(90,196,255,0.3)", color: "#5ac4ff" }}
          >
            {evaluating ? <RefreshCw className="size-4 animate-spin" /> : <Play className="size-4" />}
            {evaluating ? "Evaluiere…" : "Evaluieren"}
          </button>

          {error && (
            <div className="rounded-xl px-4 py-3 text-sm" style={{ background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.25)", color: "#f87171" }}>
              {error}
            </div>
          )}

          {evalResult && (
            <div className="rounded-xl p-4 space-y-2" style={{ background: "rgba(90,196,255,0.06)", border: "1px solid rgba(90,196,255,0.2)" }}>
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold" style={{ color: "#5ac4ff" }}>Entscheidung</span>
                {evalResult.score != null && (
                  <span className="text-xs rounded-full px-2.5 py-1" style={{ background: "rgba(90,196,255,0.12)", color: "#5ac4ff", border: "1px solid rgba(90,196,255,0.25)" }}>
                    Score: {evalResult.score}
                  </span>
                )}
              </div>
              <p className="text-base font-bold text-[var(--foreground)]">{evalResult.decision}</p>
              {evalResult.confidence != null && (
                <p className="text-xs text-[var(--muted-foreground)]">Konfidenz: {(evalResult.confidence * 100).toFixed(0)}%</p>
              )}
              {evalResult.reason && <p className="text-sm text-[var(--muted-foreground)]">{evalResult.reason}</p>}
              {evalResult.recommendation && (
                <div className="mt-2 pt-2 border-t border-white/5">
                  <p className="text-xs font-medium text-[var(--foreground)] mb-1">Empfehlung</p>
                  <p className="text-xs text-[var(--muted-foreground)]">{evalResult.recommendation}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Decision History */}
      <div className="glass-card p-5">
        <h3 className="font-semibold text-[var(--foreground)] flex items-center gap-2 mb-4">
          <BarChart3 className="size-4" style={{ color: "var(--accent)" }} />
          Decision History
          <span
            className="rounded-full px-2 py-0.5 text-xs"
            style={{ background: "rgba(90,196,255,0.12)", border: "1px solid rgba(90,196,255,0.2)", color: "#5ac4ff" }}
          >
            {decisions.length}
          </span>
        </h3>

        {decisions.length === 0 ? (
          <p className="text-sm text-[var(--muted-foreground)] text-center py-6">Noch keine Entscheidungen</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-[var(--muted-foreground)] border-b border-white/5">
                  <th className="pb-2 pr-4 font-medium">Zeitpunkt</th>
                  <th className="pb-2 pr-4 font-medium">Entscheidung</th>
                  <th className="pb-2 pr-4 font-medium">Score</th>
                  <th className="pb-2 font-medium">Begründung</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {decisions.slice(0, 20).map(d => (
                  <tr key={d.id} className="text-[var(--foreground)]">
                    <td className="py-2.5 pr-4 text-xs text-[var(--muted-foreground)] whitespace-nowrap">{fmtDate(d.timestamp)}</td>
                    <td className="py-2.5 pr-4 font-medium">{d.decision}</td>
                    <td className="py-2.5 pr-4 text-xs" style={{ color: "#5ac4ff" }}>
                      {d.score != null ? d.score : "—"}
                    </td>
                    <td className="py-2.5 text-xs text-[var(--muted-foreground)] max-w-xs truncate">{d.reason ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
