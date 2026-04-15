"use client";

import { useState, useEffect, useCallback } from "react";
import { Monitor, Camera, Play, Square, Lock, Unlock, RefreshCw, AlertTriangle, CheckCircle, Loader2, MousePointer, Keyboard, Scan } from "lucide-react";

type DesktopStatus = {
  enabled: boolean;
  platform?: string;
  locked?: boolean;
  stopRequested?: boolean;
  sessionId?: string;
  error?: string;
};

type ActionType = "click" | "type" | "hotkey" | "scroll" | "move";

const ACTION_TYPES: { value: ActionType; label: string }[] = [
  { value: "click",  label: "Klick" },
  { value: "type",   label: "Text eingeben" },
  { value: "hotkey", label: "Tastenkürzel" },
  { value: "scroll", label: "Scrollen" },
  { value: "move",   label: "Maus bewegen" },
];

export default function DesktopPage() {
  const [activeTab, setActiveTab] = useState<"status" | "action" | "session">("status");
  const [status, setStatus] = useState<DesktopStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Screenshot
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [screenshotLoading, setScreenshotLoading] = useState(false);

  // Action form
  const [actionType, setActionType] = useState<ActionType>("click");
  const [actionX, setActionX] = useState("");
  const [actionY, setActionY] = useState("");
  const [actionText, setActionText] = useState("");
  const [actionKeys, setActionKeys] = useState("");
  const [actionResult, setActionResult] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Session
  const [sessionLoading, setSessionLoading] = useState(false);
  const [sessionMsg, setSessionMsg] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/desktop?section=status");
      const json = await res.json();
      setStatus(json);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Fehler beim Laden");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadStatus(); }, [loadStatus]);

  async function takeScreenshot() {
    setScreenshotLoading(true);
    setScreenshot(null);
    try {
      const res = await fetch("/api/desktop?action=screenshot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const json = await res.json();
      if (json.image || json.screenshot) {
        setScreenshot(json.image || json.screenshot);
      } else {
        setActionResult(json.error || "Kein Screenshot zurückgegeben");
      }
    } catch (e: unknown) {
      setActionResult(e instanceof Error ? e.message : "Screenshot fehlgeschlagen");
    } finally {
      setScreenshotLoading(false);
    }
  }

  async function sendAction() {
    setActionLoading(true);
    setActionResult(null);
    try {
      const payload: Record<string, unknown> = { action: actionType };
      if (actionType === "click" || actionType === "move" || actionType === "scroll") {
        payload.x = Number(actionX);
        payload.y = Number(actionY);
      }
      if (actionType === "type") payload.text = actionText;
      if (actionType === "hotkey") payload.keys = actionKeys.split("+").map(k => k.trim());

      const res = await fetch("/api/desktop?action=action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      setActionResult(json.success ? "Aktion ausgeführt" : (json.error || "Fehler"));
    } catch (e: unknown) {
      setActionResult(e instanceof Error ? e.message : "Fehler");
    } finally {
      setActionLoading(false);
    }
  }

  async function stopActions() {
    setActionLoading(true);
    try {
      await fetch("/api/desktop?action=stop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "manual_stop" }),
      });
      setActionResult("Aktionen gestoppt");
      await loadStatus();
    } finally {
      setActionLoading(false);
    }
  }

  async function sessionAction(action: "lock" | "unlock") {
    setSessionLoading(true);
    setSessionMsg(null);
    try {
      const res = await fetch(`/api/desktop?action=${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const json = await res.json();
      setSessionMsg(json.success ? `Session ${action === "lock" ? "gesperrt" : "entsperrt"}` : (json.error || "Fehler"));
      await loadStatus();
    } finally {
      setSessionLoading(false);
    }
  }

  const tabs = [
    { id: "status" as const,  label: "Status",  icon: Monitor },
    { id: "action" as const,  label: "Aktionen", icon: MousePointer },
    { id: "session" as const, label: "Session",  icon: Lock },
  ];

  return (
    <div className="min-h-screen bg-[#0d1117] text-white p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Monitor className="text-[#5ac4ff]" size={28} />
            <div>
              <h1 className="text-2xl font-bold">Desktop Automation</h1>
              <p className="text-sm text-gray-400">Screenshot, Aktionen und Session-Steuerung</p>
            </div>
          </div>
          <button
            onClick={loadStatus}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-sm hover:bg-white/10 transition-colors"
          >
            <RefreshCw size={14} />
            Aktualisieren
          </button>
        </div>

        {/* Status Banner */}
        {!loading && status && (
          <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${
            !status.enabled
              ? "bg-yellow-500/10 border-yellow-500/30 text-yellow-400"
              : status.locked
              ? "bg-red-500/10 border-red-500/30 text-red-400"
              : "bg-green-500/10 border-green-500/30 text-green-400"
          }`}>
            {!status.enabled ? (
              <AlertTriangle size={16} />
            ) : status.locked ? (
              <Lock size={16} />
            ) : (
              <CheckCircle size={16} />
            )}
            <span className="text-sm font-medium">
              {!status.enabled
                ? "Desktop-Automation deaktiviert — DESKTOP_CONTROL_ENABLED=true setzen"
                : status.locked
                ? "Session gesperrt"
                : `Aktiv${status.platform ? ` · ${status.platform}` : ""}${status.stopRequested ? " · Stop angefordert" : ""}`}
            </span>
          </div>
        )}

        {error && (
          <div className="px-4 py-3 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-white/5 rounded-xl border border-white/10 w-fit">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === id
                  ? "bg-[#5ac4ff]/20 text-[#5ac4ff] border border-[#5ac4ff]/30"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>

        {/* Tab: Status + Screenshot */}
        {activeTab === "status" && (
          <div className="space-y-4">
            {loading ? (
              <div className="flex items-center gap-2 text-gray-400 text-sm py-8 justify-center">
                <Loader2 className="animate-spin" size={16} />
                Lade Status...
              </div>
            ) : status ? (
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: "Aktiviert",  value: status.enabled   ? "Ja" : "Nein" },
                  { label: "Plattform",  value: status.platform  || "—" },
                  { label: "Gesperrt",   value: status.locked    ? "Ja" : "Nein" },
                  { label: "Stop Flag",  value: status.stopRequested ? "Gesetzt" : "Nicht gesetzt" },
                ].map(({ label, value }) => (
                  <div key={label} className="rounded-xl border border-white/10 bg-white/5 p-4">
                    <div className="text-xs text-gray-400 mb-1">{label}</div>
                    <div className="text-sm font-medium">{value}</div>
                  </div>
                ))}
              </div>
            ) : null}

            {/* Screenshot */}
            <div className="rounded-xl border border-white/10 bg-white/5 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Camera size={16} className="text-[#5ac4ff]" />
                  Screenshot
                </div>
                <button
                  onClick={takeScreenshot}
                  disabled={screenshotLoading || !status?.enabled}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#5ac4ff]/20 border border-[#5ac4ff]/30 text-[#5ac4ff] text-sm hover:bg-[#5ac4ff]/30 transition-colors disabled:opacity-40"
                >
                  {screenshotLoading ? <Loader2 className="animate-spin" size={14} /> : <Camera size={14} />}
                  Aufnehmen
                </button>
              </div>
              {screenshot ? (
                <img
                  src={`data:image/png;base64,${screenshot}`}
                  alt="Desktop Screenshot"
                  className="w-full rounded-lg border border-white/10"
                />
              ) : (
                <div className="flex items-center justify-center h-32 rounded-lg border border-dashed border-white/10 text-gray-500 text-sm">
                  Noch kein Screenshot
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab: Actions */}
        {activeTab === "action" && (
          <div className="rounded-xl border border-white/10 bg-white/5 p-5 space-y-5">
            <div className="flex items-center gap-2 text-sm font-medium">
              <MousePointer size={16} className="text-[#5ac4ff]" />
              Aktion ausführen
            </div>

            {/* Action type */}
            <div className="space-y-2">
              <label className="text-xs text-gray-400">Aktionstyp</label>
              <div className="flex flex-wrap gap-2">
                {ACTION_TYPES.map(({ value, label }) => (
                  <button
                    key={value}
                    onClick={() => setActionType(value)}
                    className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                      actionType === value
                        ? "bg-[#5ac4ff]/20 border-[#5ac4ff]/40 text-[#5ac4ff]"
                        : "border-white/10 text-gray-400 hover:text-white hover:border-white/20"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Coordinates for click/move/scroll */}
            {(actionType === "click" || actionType === "move" || actionType === "scroll") && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-gray-400">X</label>
                  <input
                    type="number"
                    value={actionX}
                    onChange={e => setActionX(e.target.value)}
                    placeholder="0"
                    className="w-full bg-[#0d1117] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#5ac4ff]/50"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-gray-400">Y</label>
                  <input
                    type="number"
                    value={actionY}
                    onChange={e => setActionY(e.target.value)}
                    placeholder="0"
                    className="w-full bg-[#0d1117] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#5ac4ff]/50"
                  />
                </div>
              </div>
            )}

            {/* Text for type */}
            {actionType === "type" && (
              <div className="space-y-1">
                <label className="text-xs text-gray-400 flex items-center gap-1"><Keyboard size={12} /> Eingabetext</label>
                <input
                  type="text"
                  value={actionText}
                  onChange={e => setActionText(e.target.value)}
                  placeholder="Text der eingegeben werden soll"
                  className="w-full bg-[#0d1117] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#5ac4ff]/50"
                />
              </div>
            )}

            {/* Keys for hotkey */}
            {actionType === "hotkey" && (
              <div className="space-y-1">
                <label className="text-xs text-gray-400">Tastenkombination (z.B. ctrl+c)</label>
                <input
                  type="text"
                  value={actionKeys}
                  onChange={e => setActionKeys(e.target.value)}
                  placeholder="ctrl+c"
                  className="w-full bg-[#0d1117] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#5ac4ff]/50"
                />
              </div>
            )}

            {/* Buttons */}
            <div className="flex gap-3">
              <button
                onClick={sendAction}
                disabled={actionLoading || !status?.enabled}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#5ac4ff]/20 border border-[#5ac4ff]/30 text-[#5ac4ff] text-sm hover:bg-[#5ac4ff]/30 transition-colors disabled:opacity-40"
              >
                {actionLoading ? <Loader2 className="animate-spin" size={14} /> : <Play size={14} />}
                Ausführen
              </button>
              <button
                onClick={stopActions}
                disabled={actionLoading}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm hover:bg-red-500/20 transition-colors disabled:opacity-40"
              >
                <Square size={14} />
                Stop
              </button>
            </div>

            {actionResult && (
              <div className={`px-3 py-2 rounded-lg text-sm border ${
                actionResult.includes("fehler") || actionResult.includes("Fehler")
                  ? "border-red-500/30 bg-red-500/10 text-red-400"
                  : "border-green-500/30 bg-green-500/10 text-green-400"
              }`}>
                {actionResult}
              </div>
            )}
          </div>
        )}

        {/* Tab: Session */}
        {activeTab === "session" && (
          <div className="rounded-xl border border-white/10 bg-white/5 p-5 space-y-5">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Lock size={16} className="text-[#5ac4ff]" />
              Session-Verwaltung
            </div>

            <div className="text-sm text-gray-400">
              Session sperren verhindert neue Desktop-Aktionen. Entsperren gibt die Steuerung wieder frei.
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
                <div className="text-xs text-gray-400">Aktueller Status</div>
                <div className={`text-sm font-medium flex items-center gap-2 ${status?.locked ? "text-red-400" : "text-green-400"}`}>
                  {status?.locked ? <Lock size={14} /> : <Unlock size={14} />}
                  {status?.locked ? "Gesperrt" : "Aktiv"}
                </div>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
                <div className="text-xs text-gray-400">Stop-Flag</div>
                <div className={`text-sm font-medium ${status?.stopRequested ? "text-yellow-400" : "text-gray-300"}`}>
                  {status?.stopRequested ? "Gesetzt" : "Nicht gesetzt"}
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => sessionAction("lock")}
                disabled={sessionLoading || !!status?.locked}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm hover:bg-red-500/20 transition-colors disabled:opacity-40"
              >
                {sessionLoading ? <Loader2 className="animate-spin" size={14} /> : <Lock size={14} />}
                Sperren
              </button>
              <button
                onClick={() => sessionAction("unlock")}
                disabled={sessionLoading || !status?.locked}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-500/10 border border-green-500/30 text-green-400 text-sm hover:bg-green-500/20 transition-colors disabled:opacity-40"
              >
                {sessionLoading ? <Loader2 className="animate-spin" size={14} /> : <Unlock size={14} />}
                Entsperren
              </button>
            </div>

            {sessionMsg && (
              <div className="px-3 py-2 rounded-lg text-sm border border-white/10 bg-white/5 text-gray-300">
                {sessionMsg}
              </div>
            )}

            <div className="flex items-start gap-2 px-3 py-2 rounded-lg border border-yellow-500/20 bg-yellow-500/5 text-yellow-400/80 text-xs">
              <Scan size={12} className="mt-0.5 shrink-0" />
              Desktop-Automation erfordert <code className="mx-1 font-mono">DESKTOP_CONTROL_ENABLED=true</code> in der .env-Konfiguration.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
