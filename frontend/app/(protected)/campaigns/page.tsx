"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Megaphone, Plus, Play, Trash2, RefreshCw, Loader2, CheckCircle, XCircle, Clock, AlertTriangle, FileText } from "lucide-react";

type Campaign = {
  id: string;
  name: string;
  goal: string;
  product: string;
  platforms: string[];
  status: "draft" | "running" | "completed" | "failed" | "deleted";
  budgetCents: number;
  currency: string;
  createdAt: string;
  contentPlan?: { content?: string; status?: string; note?: string } | null;
  budget?: { utilizationPct?: number; status?: string; remaining?: number } | null;
};

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  draft:     { label: "Entwurf",    color: "text-gray-400 border-gray-600  bg-gray-500/10",  icon: FileText    },
  running:   { label: "Läuft",      color: "text-blue-400 border-blue-500/30 bg-blue-500/10",  icon: Loader2     },
  completed: { label: "Fertig",     color: "text-green-400 border-green-500/30 bg-green-500/10", icon: CheckCircle },
  failed:    { label: "Fehler",     color: "text-red-400 border-red-500/30 bg-red-500/10",    icon: XCircle     },
  deleted:   { label: "Gelöscht",   color: "text-gray-600 border-gray-700 bg-gray-800/10",    icon: Trash2      },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.draft;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.color}`}>
      <Icon size={11} className={status === "running" ? "animate-spin" : ""} />
      {cfg.label}
    </span>
  );
}

function PlatformTag({ p }: { p: string }) {
  return (
    <span className="px-1.5 py-0.5 rounded text-xs bg-white/5 border border-white/10 text-gray-300">
      {p}
    </span>
  );
}

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [executing, setExecuting] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch("/api/campaigns");
      const json = await res.json();
      setCampaigns(Array.isArray(json?.items) ? json.items : []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Fehler beim Laden");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function execute(id: string) {
    setExecuting(id);
    try {
      await fetch(`/api/campaigns/${id}/execute`, { method: "POST" });
      await load();
    } finally {
      setExecuting(null);
    }
  }

  async function remove(id: string) {
    setDeleting(id);
    try {
      await fetch(`/api/campaigns/${id}`, { method: "DELETE" });
      await load();
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div className="min-h-screen bg-[#0d1117] text-white p-6">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Megaphone className="text-[#5ac4ff]" size={28} />
            <div>
              <h1 className="text-2xl font-bold">Campaign Orchestrator</h1>
              <p className="text-sm text-gray-400">Kampagnen planen, Content generieren und koordinieren</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={load} className="p-2 rounded-lg bg-white/5 border border-white/10 text-gray-400 hover:text-white transition-colors">
              <RefreshCw size={15} />
            </button>
            <Link
              href="/campaigns/new"
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#5ac4ff]/20 border border-[#5ac4ff]/30 text-[#5ac4ff] text-sm font-medium hover:bg-[#5ac4ff]/30 transition-colors"
            >
              <Plus size={15} />
              Neue Kampagne
            </Link>
          </div>
        </div>

        {/* Community Edition Note */}
        <div className="flex items-start gap-2 px-4 py-3 rounded-xl border border-yellow-500/20 bg-yellow-500/5 text-yellow-400/80 text-xs">
          <AlertTriangle size={13} className="mt-0.5 shrink-0" />
          <span>
            <strong>Community Edition:</strong> Kampagnen erzeugen Content + Plan via DAG. Direktes Posten auf X/Twitter und Instagram ist enthalten.
            E-Mail/Newsletter und LinkedIn erfordern einen separaten Connector (nicht in der Community Edition).
          </span>
        </div>

        {error && (
          <div className="px-4 py-3 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Campaign List */}
        {loading ? (
          <div className="flex items-center justify-center gap-3 py-16 text-gray-400 text-sm">
            <Loader2 className="animate-spin" size={20} />
            Lade Kampagnen...
          </div>
        ) : campaigns.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 py-16 text-gray-500">
            <Megaphone size={40} className="opacity-30" />
            <div className="text-center">
              <div className="text-base font-medium text-gray-400">Keine Kampagnen</div>
              <div className="text-sm mt-1">Erstelle deine erste Kampagne mit dem Wizard.</div>
            </div>
            <Link
              href="/campaigns/new"
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#5ac4ff]/20 border border-[#5ac4ff]/30 text-[#5ac4ff] text-sm hover:bg-[#5ac4ff]/30 transition-colors"
            >
              <Plus size={14} />
              Erste Kampagne erstellen
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {campaigns.map(c => (
              <div key={c.id} className="rounded-xl border border-white/10 bg-white/5 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-2 flex-1 min-w-0">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="font-semibold text-white truncate">{c.name}</span>
                      <StatusBadge status={c.status} />
                    </div>
                    <div className="text-sm text-gray-400 line-clamp-1">{c.goal}</div>
                    <div className="flex flex-wrap gap-1.5 items-center">
                      {c.platforms.map(p => <PlatformTag key={p} p={p} />)}
                      {c.budgetCents > 0 && (
                        <span className="px-1.5 py-0.5 rounded text-xs bg-green-500/10 border border-green-500/20 text-green-400">
                          {(c.budgetCents / 100).toFixed(2)} {c.currency}
                          {c.budget && ` · ${c.budget.utilizationPct ?? 0}% genutzt`}
                        </span>
                      )}
                    </div>
                    {c.contentPlan?.status === 'ready_for_review' && (
                      <div className="text-xs text-[#5ac4ff]/80 flex items-center gap-1">
                        <CheckCircle size={11} />
                        Content bereit — {c.contentPlan.note}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {(c.status === 'draft' || c.status === 'failed') && (
                      <button
                        onClick={() => execute(c.id)}
                        disabled={executing === c.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#5ac4ff]/15 border border-[#5ac4ff]/30 text-[#5ac4ff] text-xs hover:bg-[#5ac4ff]/25 transition-colors disabled:opacity-40"
                      >
                        {executing === c.id ? <Loader2 className="animate-spin" size={12} /> : <Play size={12} />}
                        Ausführen
                      </button>
                    )}
                    <button
                      onClick={() => remove(c.id)}
                      disabled={deleting === c.id || c.status === 'running'}
                      className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-30"
                    >
                      {deleting === c.id ? <Loader2 className="animate-spin" size={13} /> : <Trash2 size={13} />}
                    </button>
                  </div>
                </div>

                {/* Content Preview */}
                {c.status === 'completed' && c.contentPlan?.content && (
                  <div className="mt-4 pt-4 border-t border-white/5">
                    <div className="text-xs text-gray-500 mb-1.5">Generierter Content (Vorschau)</div>
                    <pre className="text-xs text-gray-300 whitespace-pre-wrap font-mono line-clamp-4 leading-relaxed">
                      {String(c.contentPlan.content).slice(0, 400)}{String(c.contentPlan.content).length > 400 ? '…' : ''}
                    </pre>
                  </div>
                )}

                <div className="mt-3 text-xs text-gray-600">
                  <Clock size={10} className="inline mr-1" />
                  {new Date(c.createdAt).toLocaleDateString('de-DE')} · Produkt: {c.product}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
