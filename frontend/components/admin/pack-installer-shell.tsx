"use client";

import { useEffect, useState } from "react";
import { CheckCircle, Download, Loader2, Package, RefreshCw, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type Pack = {
  id: string;
  name: string;
  version: string;
  description: string;
  category?: string;
};

type InstallStatus = "idle" | "installing" | "success" | "error";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function PackInstallerShell() {
  const [packs, setPacks] = useState<Pack[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState("");
  const [installStatus, setInstallStatus] = useState<Record<string, InstallStatus>>({});
  const [installError, setInstallError] = useState<Record<string, string>>({});

  async function loadPacks() {
    setLoading(true);
    setFetchError("");
    try {
      const res = await fetch("/api/packs/registry", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const list: Pack[] = Array.isArray(data)
        ? data
        : Array.isArray(data?.packs)
          ? data.packs
          : [];
      setPacks(list);
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : "Fehler beim Laden");
      // Fallback demo data
      setPacks([
        { id: "retail-pack", name: "Retail Pack", version: "1.2.0", description: "E-Commerce Integrationen und Flows", category: "Commerce" },
        { id: "analytics-pack", name: "Analytics Pack", version: "2.0.1", description: "BI-Dashboards und Datenexporte", category: "Analytics" },
        { id: "compliance-pack", name: "Compliance Pack", version: "1.0.4", description: "DSGVO, Audit-Logs und Reports", category: "Governance" },
        { id: "ai-pack", name: "AI/ML Pack", version: "3.1.0", description: "LLM-Integrationen und Prompt-Management", category: "AI" },
      ]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPacks();
  }, []);

  async function installPack(pack: Pack) {
    setInstallStatus((prev) => ({ ...prev, [pack.id]: "installing" }));
    setInstallError((prev) => ({ ...prev, [pack.id]: "" }));

    try {
      const res = await fetch("/api/packs/install", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packId: pack.id, version: pack.version }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.message ?? `HTTP ${res.status}`);
      }
      setInstallStatus((prev) => ({ ...prev, [pack.id]: "success" }));
    } catch (err) {
      setInstallStatus((prev) => ({ ...prev, [pack.id]: "error" }));
      setInstallError((prev) => ({
        ...prev,
        [pack.id]: err instanceof Error ? err.message : "Installationsfehler",
      }));
    }
  }

  return (
    <div className="rounded-[32px] border border-white/10 bg-black/20 p-5 backdrop-blur">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Pack Installer</h2>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            Verfügbare Packs aus der Registry installieren.
          </p>
        </div>
        <button
          type="button"
          onClick={loadPacks}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm transition hover:border-[rgba(90,196,255,0.3)] hover:bg-[rgba(90,196,255,0.08)] disabled:opacity-50"
        >
          <RefreshCw className={cn("size-4", loading && "animate-spin")} />
          Aktualisieren
        </button>
      </div>

      {fetchError && (
        <div className="mt-3 flex items-center gap-2 rounded-[14px] border border-yellow-500/20 bg-yellow-500/10 px-3 py-2 text-xs text-yellow-300">
          <XCircle className="size-3.5 shrink-0" />
          Registry nicht erreichbar — Demo-Daten werden gezeigt. ({fetchError})
        </div>
      )}

      <div className="mt-4 space-y-3">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-[var(--muted-foreground)]">
            <Loader2 className="size-4 animate-spin" />
            Packs laden…
          </div>
        ) : packs.length === 0 ? (
          <div className="py-10 text-center text-sm text-[var(--muted-foreground)]">
            Keine Packs verfügbar.
          </div>
        ) : (
          packs.map((pack) => {
            const status = installStatus[pack.id] ?? "idle";
            return (
              <div
                key={pack.id}
                className="flex flex-wrap items-center gap-3 rounded-[20px] border border-white/10 bg-white/4 p-4"
              >
                <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-[rgba(90,196,255,0.1)] text-[var(--accent)]">
                  <Package className="size-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{pack.name}</span>
                    <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-mono text-[var(--muted-foreground)]">
                      v{pack.version}
                    </span>
                    {pack.category && (
                      <span className="rounded-full border border-[rgba(90,196,255,0.2)] bg-[rgba(90,196,255,0.06)] px-2 py-0.5 text-[10px] text-[var(--accent)]">
                        {pack.category}
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">
                    {pack.description}
                  </p>
                  {status === "error" && installError[pack.id] && (
                    <p className="mt-1 text-xs text-red-400">{installError[pack.id]}</p>
                  )}
                </div>
                <button
                  type="button"
                  disabled={status === "installing" || status === "success"}
                  onClick={() => installPack(pack)}
                  className={cn(
                    "inline-flex shrink-0 items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium transition",
                    status === "success"
                      ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300 cursor-default"
                      : status === "error"
                        ? "border-red-500/20 bg-red-500/10 text-red-300 hover:bg-red-500/15"
                        : "border-[rgba(90,196,255,0.3)] bg-[rgba(90,196,255,0.1)] text-[var(--accent)] hover:bg-[rgba(90,196,255,0.18)] disabled:cursor-not-allowed disabled:opacity-50",
                  )}
                >
                  {status === "installing" && <Loader2 className="size-3.5 animate-spin" />}
                  {status === "success" && <CheckCircle className="size-3.5" />}
                  {status === "error" && <XCircle className="size-3.5" />}
                  {status === "idle" && <Download className="size-3.5" />}
                  {status === "installing"
                    ? "Installieren…"
                    : status === "success"
                      ? "Installiert"
                      : status === "error"
                        ? "Wiederholen"
                        : "Installieren"}
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
