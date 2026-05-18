"use client";

import { useState, useEffect, useCallback } from "react";
import { Bell, RefreshCw, Loader2, CheckCheck, Trash2, Info, CheckCircle, AlertTriangle, XCircle, BellOff } from "lucide-react";
import Link from "next/link";

// ── Types ──────────────────────────────────────────────────────────────────

type NotifType = "info" | "success" | "warning" | "error";

type Notification = {
  id:        string;
  event:     string;
  type:      NotifType;
  title:     string;
  message:   string | null;
  link:      string | null;
  read:      boolean;
  createdAt: string;
};

// ── Helpers ────────────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<NotifType, { icon: React.ElementType; cls: string }> = {
  info:    { icon: Info,          cls: "text-[#5ac4ff] bg-[#5ac4ff]/10 border-[#5ac4ff]/20" },
  success: { icon: CheckCircle,   cls: "text-green-400 bg-green-500/10 border-green-500/20" },
  warning: { icon: AlertTriangle, cls: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20" },
  error:   { icon: XCircle,       cls: "text-red-400 bg-red-500/10 border-red-500/20" },
};

function TypeIcon({ type }: { type: NotifType }) {
  const cfg = TYPE_CONFIG[type] ?? TYPE_CONFIG.info;
  const Icon = cfg.icon;
  return (
    <div className={`w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 ${cfg.cls}`}>
      <Icon size={14} />
    </div>
  );
}

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins  <  1) return "gerade eben";
  if (mins  < 60) return `vor ${mins} Min.`;
  if (hours < 24) return `vor ${hours} Std.`;
  return `vor ${days} Tag${days > 1 ? "en" : ""}`;
}

// ── Component ──────────────────────────────────────────────────────────────

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState<string | null>(null);
  const [filter,        setFilter]        = useState<"all" | "unread">("all");
  const [markingAll,    setMarkingAll]    = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const unreadOnly = filter === "unread" ? "true" : "false";
      const res  = await fetch(`/api/notifications?unreadOnly=${unreadOnly}&limit=100`);
      const data = await res.json();
      setNotifications(Array.isArray(data?.items) ? data.items : []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Ladefehler");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  async function markRead(id: string) {
    await fetch(`/api/notifications/${id}`, { method: "PATCH" });
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  }

  async function remove(id: string) {
    await fetch(`/api/notifications/${id}`, { method: "DELETE" });
    setNotifications(prev => prev.filter(n => n.id !== id));
  }

  async function markAllRead() {
    setMarkingAll(true);
    try {
      await fetch("/api/notifications/mark-all-read", { method: "POST" });
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    } finally {
      setMarkingAll(false);
    }
  }

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className="min-h-screen bg-[#0d1117] text-white p-6">
      <div className="max-w-2xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Bell className="text-[#5ac4ff]" size={28} />
            <div>
              <h1 className="text-2xl font-bold">Benachrichtigungen</h1>
              <p className="text-sm text-gray-400">
                {unreadCount > 0 ? `${unreadCount} ungelesen` : "Alles gelesen"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                disabled={markingAll}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-gray-400 text-xs hover:text-white transition-colors disabled:opacity-40"
              >
                {markingAll ? <Loader2 className="animate-spin" size={12} /> : <CheckCheck size={12} />}
                Alle gelesen
              </button>
            )}
            <button onClick={load} className="p-2 rounded-lg bg-white/5 border border-white/10 text-gray-400 hover:text-white transition-colors">
              <RefreshCw size={15} />
            </button>
          </div>
        </div>

        {/* Filter */}
        <div className="flex gap-1 p-1 rounded-xl bg-white/5 border border-white/10 w-fit">
          {(["all", "unread"] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-1.5 rounded-lg text-sm transition-colors ${
                filter === f ? "bg-[#5ac4ff]/20 text-[#5ac4ff] border border-[#5ac4ff]/30" : "text-gray-400 hover:text-white"
              }`}
            >
              {f === "all" ? "Alle" : "Ungelesen"}
            </button>
          ))}
        </div>

        {error && (
          <div className="px-4 py-3 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 text-sm">{error}</div>
        )}

        {/* List */}
        {loading ? (
          <div className="flex items-center justify-center gap-3 py-16 text-gray-400 text-sm">
            <Loader2 className="animate-spin" size={20} /> Lade...
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-gray-500">
            <BellOff size={36} className="opacity-30" />
            <div className="text-sm text-center">
              {filter === "unread" ? "Keine ungelesenen Benachrichtigungen" : "Keine Benachrichtigungen"}
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {notifications.map(n => (
              <div
                key={n.id}
                className={`rounded-xl border p-4 transition-colors ${
                  n.read ? "border-white/5 bg-white/[0.02]" : "border-white/10 bg-white/5"
                }`}
              >
                <div className="flex items-start gap-3">
                  <TypeIcon type={n.type} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        {n.link ? (
                          <Link href={n.link} className="text-sm font-medium text-white hover:text-[#5ac4ff] transition-colors">
                            {n.title}
                          </Link>
                        ) : (
                          <span className={`text-sm font-medium ${n.read ? "text-gray-400" : "text-white"}`}>{n.title}</span>
                        )}
                        {n.message && (
                          <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.message}</p>
                        )}
                        <div className="flex items-center gap-2 mt-1.5">
                          <span className="text-xs text-gray-600">{relativeTime(n.createdAt)}</span>
                          <span className="text-gray-700">·</span>
                          <span className="font-mono text-xs text-gray-600">{n.event}</span>
                          {!n.read && (
                            <span className="w-1.5 h-1.5 rounded-full bg-[#5ac4ff] shrink-0" />
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {!n.read && (
                          <button
                            onClick={() => markRead(n.id)}
                            className="p-1.5 rounded-lg text-gray-600 hover:text-[#5ac4ff] hover:bg-[#5ac4ff]/10 transition-colors"
                            title="Als gelesen markieren"
                          >
                            <CheckCheck size={13} />
                          </button>
                        )}
                        <button
                          onClick={() => remove(n.id)}
                          className="p-1.5 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                          title="Löschen"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}
