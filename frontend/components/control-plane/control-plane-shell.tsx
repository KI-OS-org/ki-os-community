"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  Shield,
  Zap,
  GitBranch,
  Database,
  XCircle,
  Info,
  RefreshCw,
  Server,
  Cpu,
} from "lucide-react";

/* ─── Types ────────────────────────────────────────────────────────────────── */
interface HealthData {
  status?: string;
  checks?: Record<string, "ok" | "fail" | boolean | string>;
  runtime?: { uptime?: number; version?: string; env?: string };
  message?: string;
}

interface IncidentRecord {
  id?: string;
  title?: string;
  message?: string;
  severity?: "critical" | "warning" | "info" | string;
  createdAt?: string;
  status?: string;
}

interface TraceRecord {
  traceId?: string;
  id?: string;
  model?: string;
  status?: string;
  duration?: number;
  startedAt?: string;
  timestamp?: string;
}

interface SupervisorData {
  escalations?: number | unknown[];
  recoveries?: number | unknown[];
  meshNodes?: unknown[];
  workers?: number;
  state?: string;
  autoheal?: boolean;
}

interface SecurityItem {
  id?: string;
  name?: string;
  label?: string;
  type?: string;
  status?: string;
  severity?: string;
}

interface MetricsData {
  [key: string]: unknown;
}

interface ControlPlaneShellProps {
  health: unknown;
  incidents: unknown;
  supervisor: unknown;
  traces: unknown;
  security: unknown;
  metrics: unknown;
}

/* ─── Helpers ───────────────────────────────────────────────────────────────── */
function formatUptime(seconds: number | undefined): string {
  if (!seconds) return "—";
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return "—";
  try {
    return new Date(dateStr).toLocaleString("de-DE", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateStr;
  }
}

function statusBg(status: string | undefined) {
  switch (status?.toLowerCase()) {
    case "healthy":
    case "ok":
    case "up":
    case "completed":
      return { bg: "rgba(34,197,94,0.10)", border: "rgba(34,197,94,0.24)", color: "var(--status-green)" };
    case "degraded":
    case "warning":
      return { bg: "rgba(234,179,8,0.10)", border: "rgba(234,179,8,0.24)", color: "var(--status-yellow)" };
    case "down":
    case "critical":
    case "failed":
    case "error":
      return { bg: "rgba(248,113,113,0.10)", border: "rgba(248,113,113,0.24)", color: "var(--status-red)" };
    default:
      return { bg: "rgba(90,196,255,0.08)", border: "rgba(90,196,255,0.20)", color: "var(--status-blue)" };
  }
}

function severityStyle(severity: string | undefined) {
  switch (severity?.toLowerCase()) {
    case "critical":
      return { bg: "rgba(248,113,113,0.12)", border: "rgba(248,113,113,0.28)", color: "var(--status-red)" };
    case "warning":
      return { bg: "rgba(234,179,8,0.12)", border: "rgba(234,179,8,0.28)", color: "var(--status-yellow)" };
    case "info":
    default:
      return { bg: "rgba(90,196,255,0.10)", border: "rgba(90,196,255,0.22)", color: "var(--status-blue)" };
  }
}

function SeverityIcon({ severity }: { severity: string | undefined }) {
  switch (severity?.toLowerCase()) {
    case "critical":
      return <XCircle className="size-4" style={{ color: "var(--status-red)" }} />;
    case "warning":
      return <AlertTriangle className="size-4" style={{ color: "var(--status-yellow)" }} />;
    default:
      return <Info className="size-4" style={{ color: "var(--status-blue)" }} />;
  }
}

/* ─── Auto-refresher ────────────────────────────────────────────────────────── */
export function ControlPlaneRefresher({ intervalMs = 15000 }: { intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    const timer = setInterval(() => {
      router.refresh();
    }, intervalMs);
    return () => clearInterval(timer);
  }, [router, intervalMs]);

  return (
    <div
      className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs"
      style={{
        background: "rgba(90,196,255,0.08)",
        border: "1px solid rgba(90,196,255,0.18)",
        color: "var(--muted-foreground)",
      }}
    >
      <RefreshCw className="size-3 animate-spin" style={{ animationDuration: "3s" }} />
      Auto-refresh every {intervalMs / 1000}s
    </div>
  );
}

/* ─── Health Panel ──────────────────────────────────────────────────────────── */
function HealthPanel({ health }: { health: HealthData | null }) {
  const status = health?.status || "unknown";
  const checks = health?.checks || {};
  const runtime = health?.runtime;
  const colors = statusBg(status);

  return (
    <div className="glass-card p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Activity className="size-5" style={{ color: "var(--accent)" }} />
        <h3 className="text-base font-semibold text-[var(--foreground)]">System Health</h3>
      </div>

      <div
        className="flex items-center gap-3 rounded-xl p-3"
        style={{ background: colors.bg, border: `1px solid ${colors.border}` }}
      >
        <div
          className="size-2.5 rounded-full"
          style={{ background: colors.color, boxShadow: `0 0 6px ${colors.color}` }}
        />
        <span className="text-sm font-medium" style={{ color: colors.color }}>
          {status.toUpperCase()}
        </span>
        {health?.message && (
          <span className="text-xs text-[var(--muted-foreground)]">{health.message}</span>
        )}
      </div>

      {Object.keys(checks).length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wider">Checks</p>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(checks).map(([key, val]) => {
              const passing =
                val === "ok" || val === true || val === "healthy" || val === "up";
              return (
                <div
                  key={key}
                  className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs"
                  style={{ background: "rgba(255,255,255,0.04)" }}
                >
                  {passing ? (
                    <CheckCircle className="size-3.5 shrink-0" style={{ color: "var(--status-green)" }} />
                  ) : (
                    <XCircle className="size-3.5 shrink-0" style={{ color: "var(--status-red)" }} />
                  )}
                  <span className="truncate text-[var(--foreground)]">{key}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {runtime && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wider">Runtime</p>
          <div className="grid grid-cols-3 gap-2 text-xs">
            {runtime.uptime !== undefined && (
              <div
                className="rounded-lg p-2.5 text-center"
                style={{ background: "rgba(255,255,255,0.04)" }}
              >
                <p className="text-[var(--muted-foreground)]">Uptime</p>
                <p className="mt-0.5 font-semibold text-[var(--foreground)]">
                  {formatUptime(runtime.uptime)}
                </p>
              </div>
            )}
            {runtime.version && (
              <div
                className="rounded-lg p-2.5 text-center"
                style={{ background: "rgba(255,255,255,0.04)" }}
              >
                <p className="text-[var(--muted-foreground)]">Version</p>
                <p className="mt-0.5 font-semibold text-[var(--foreground)]">{runtime.version}</p>
              </div>
            )}
            {runtime.env && (
              <div
                className="rounded-lg p-2.5 text-center"
                style={{ background: "rgba(255,255,255,0.04)" }}
              >
                <p className="text-[var(--muted-foreground)]">Env</p>
                <p className="mt-0.5 font-semibold text-[var(--foreground)]">{runtime.env}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Metrics Panel ─────────────────────────────────────────────────────────── */

// Keys die als Datum formatiert werden
const METRIC_DATE_KEYS = new Set(["bootedAt", "startedAt", "createdAt", "updatedAt", "lastSeen"]);
// Keys die als gekürzte IDs angezeigt werden (nicht als Metrik-Wert)
const METRIC_ID_KEYS = new Set(["traceId", "sessionId", "requestId", "correlationId"]);
// Keys die ein " ms" Suffix bekommen
const METRIC_MS_KEYS = new Set(["avgLatencyMs", "p95LatencyMs", "p99LatencyMs", "latencyMs", "durationMs"]);
// Leserliche Labels für bekannte Keys
const METRIC_LABELS: Record<string, string> = {
  requestsTotal:   "Requests",
  errorsTotal:     "Errors",
  errorRate:       "Error Rate",
  avgLatencyMs:    "Avg Latency",
  p95LatencyMs:    "P95 Latency",
  p99LatencyMs:    "P99 Latency",
  requestsPublic:  "Public Req.",
  requestsByRoute: "By Route",
  bootedAt:        "Booted At",
  traceId:         "Last Trace",
  uptime:          "Uptime",
  version:         "Version",
};

function metricLabel(key: string): string {
  if (METRIC_LABELS[key]) return METRIC_LABELS[key];
  // camelCase → "Camel Case"
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (s) => s.toUpperCase())
    .trim();
}

function formatScalarMetric(key: string, val: unknown): string {
  if (val === null || val === undefined) return "—";

  // Datum
  if (METRIC_DATE_KEYS.has(key) && typeof val === "string") {
    return formatDate(val);
  }
  // ID → stark kürzen: letzten 8 Zeichen
  if (METRIC_ID_KEYS.has(key) && typeof val === "string") {
    const s = val.replace(/^trace-\d+T[\d:.Z]+\s*/i, ""); // strip timestamp-prefix if any
    return s.length > 10 ? "…" + s.slice(-10) : s;
  }
  // Zahl
  if (typeof val === "number") {
    if (METRIC_MS_KEYS.has(key)) return val.toLocaleString("de-DE") + " ms";
    if (key.toLowerCase().includes("rate")) return val.toFixed(2);
    if (val > 999999) return (val / 1000000).toFixed(1) + "M";
    if (val > 9999) return (val / 1000).toFixed(1) + "k";
    return val.toLocaleString("de-DE");
  }
  // Boolean
  if (typeof val === "boolean") return val ? "on" : "off";
  // String (kurz genug)
  if (typeof val === "string") {
    return val.length > 18 ? val.slice(0, 8) + "…" + val.slice(-6) : val;
  }
  return "—";
}

function MetricsPanel({ metrics }: { metrics: MetricsData | null }) {
  if (!metrics || Object.keys(metrics).length === 0) {
    return (
      <div className="glass-card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Cpu className="size-5" style={{ color: "var(--accent)" }} />
          <h3 className="text-base font-semibold text-[var(--foreground)]">Metrics</h3>
        </div>
        <p className="text-sm text-[var(--muted-foreground)] py-4 text-center">No metrics available.</p>
      </div>
    );
  }

  // Scalar-Metriken (Zahlen, kurze Strings, Daten, IDs)
  const scalarEntries: [string, unknown][] = [];
  // Objekt-Metriken (z.B. requestsByRoute)
  const objectEntries: [string, Record<string, number>][] = [];

  for (const [key, val] of Object.entries(metrics)) {
    if (
      val !== null &&
      typeof val === "object" &&
      !Array.isArray(val) &&
      !(val instanceof Date)
    ) {
      objectEntries.push([key, val as Record<string, number>]);
    } else {
      scalarEntries.push([key, val]);
    }
  }

  return (
    <div className="glass-card p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Cpu className="size-5" style={{ color: "var(--accent)" }} />
        <h3 className="text-base font-semibold text-[var(--foreground)]">Metrics</h3>
      </div>

      {/* ── Scalar-Kacheln ──────────────────────────────────── */}
      {scalarEntries.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {scalarEntries.map(([key, val]) => {
            const isId = METRIC_ID_KEYS.has(key);
            const isDate = METRIC_DATE_KEYS.has(key);
            return (
              <div
                key={key}
                className={`rounded-xl p-3 text-center overflow-hidden ${
                  isDate || isId ? "col-span-3" : ""
                }`}
                style={{
                  background: "rgba(90,196,255,0.06)",
                  border: "1px solid rgba(90,196,255,0.12)",
                }}
              >
                <p
                  className={`font-bold leading-snug truncate ${
                    isDate || isId ? "text-sm font-mono" : "text-lg"
                  }`}
                  style={{ color: "var(--accent)" }}
                >
                  {formatScalarMetric(key, val)}
                </p>
                <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">
                  {metricLabel(key)}
                </p>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Objekt-Metriken als sortierte Liste (z.B. requestsByRoute) ── */}
      {objectEntries.map(([key, obj]) => {
        const sorted = Object.entries(obj)
          .filter(([, v]) => typeof v === "number")
          .sort(([, a], [, b]) => (b as number) - (a as number))
          .slice(0, 8);

        return (
          <div key={key}>
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-[var(--muted-foreground)]">
              {metricLabel(key)}
            </p>
            <div className="max-h-40 space-y-1 overflow-y-auto pr-1">
              {sorted.length === 0 ? (
                <p className="text-xs text-[var(--muted-foreground)]">—</p>
              ) : (
                sorted.map(([route, count]) => (
                  <div
                    key={route}
                    className="flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5"
                    style={{ background: "rgba(255,255,255,0.04)" }}
                  >
                    <span className="min-w-0 truncate font-mono text-xs text-[var(--foreground)]">
                      {route}
                    </span>
                    <span
                      className="shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold"
                      style={{
                        background: "rgba(90,196,255,0.12)",
                        border: "1px solid rgba(90,196,255,0.22)",
                        color: "var(--accent)",
                      }}
                    >
                      {(count as number).toLocaleString("de-DE")}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ─── Incidents Panel ───────────────────────────────────────────────────────── */
function IncidentsPanel({ incidents }: { incidents: IncidentRecord[] }) {
  return (
    <div className="glass-card p-5 space-y-4">
      <div className="flex items-center gap-2">
        <AlertTriangle className="size-5" style={{ color: "var(--accent)" }} />
        <h3 className="text-base font-semibold text-[var(--foreground)]">Incidents</h3>
        {incidents.length > 0 && <span className="pill-cyan">{incidents.length}</span>}
      </div>

      {incidents.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-6 text-center">
          <CheckCircle className="size-8" style={{ color: "var(--status-green)" }} />
          <p className="text-sm text-[var(--muted-foreground)]">No active incidents.</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
          {incidents.map((inc, i) => {
            const sStyle = severityStyle(inc.severity);
            return (
              <div
                key={inc.id || i}
                className="rounded-xl p-3"
                style={{ background: "rgba(255,255,255,0.04)" }}
              >
                <div className="flex items-start gap-2">
                  <SeverityIcon severity={inc.severity} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-[var(--foreground)] leading-snug">
                      {inc.title || inc.message || `Incident #${i + 1}`}
                    </p>
                    {inc.message && inc.title && (
                      <p className="mt-0.5 text-xs text-[var(--muted-foreground)] line-clamp-2">
                        {inc.message}
                      </p>
                    )}
                    <div className="mt-2 flex items-center gap-2">
                      <span
                        className="rounded-full px-2 py-0.5 text-xs font-medium"
                        style={{
                          background: sStyle.bg,
                          border: `1px solid ${sStyle.border}`,
                          color: sStyle.color,
                        }}
                      >
                        {inc.severity || "info"}
                      </span>
                      {inc.status && (
                        <span className="text-xs text-[var(--muted-foreground)]">{inc.status}</span>
                      )}
                      {inc.createdAt && (
                        <span className="text-xs text-[var(--muted-foreground)]">
                          {formatDate(inc.createdAt)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ─── Traces Panel ──────────────────────────────────────────────────────────── */
function TracesPanel({ traces }: { traces: TraceRecord[] }) {
  function traceStatusColor(status: string | undefined) {
    switch (status?.toLowerCase()) {
      case "ok":
      case "success":
      case "completed":
        return "var(--status-green)";
      case "error":
      case "failed":
        return "var(--status-red)";
      default:
        return "var(--status-blue)";
    }
  }

  return (
    <div className="glass-card p-5 space-y-4">
      <div className="flex items-center gap-2">
        <GitBranch className="size-5" style={{ color: "var(--accent)" }} />
        <h3 className="text-base font-semibold text-[var(--foreground)]">Recent Traces</h3>
        {traces.length > 0 && <span className="pill-cyan">{traces.length}</span>}
      </div>

      {traces.length === 0 ? (
        <p className="text-sm text-[var(--muted-foreground)] py-4 text-center">No traces recorded.</p>
      ) : (
        <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
          {traces.map((trace, i) => {
            const tid = trace.traceId || trace.id || `trace-${i}`;
            return (
              <div
                key={tid}
                className="flex items-center justify-between gap-3 rounded-xl px-3 py-2.5"
                style={{ background: "rgba(255,255,255,0.04)" }}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-mono text-[var(--foreground)]">
                    {String(tid).slice(-16)}
                  </p>
                  {trace.model && (
                    <p className="text-xs text-[var(--muted-foreground)]">{trace.model}</p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {trace.duration !== undefined && (
                    <span className="text-xs text-[var(--muted-foreground)]">
                      <Clock className="mr-0.5 inline size-3" />
                      {trace.duration}ms
                    </span>
                  )}
                  <span
                    className="rounded-full px-2 py-0.5 text-xs"
                    style={{ color: traceStatusColor(trace.status) }}
                  >
                    {trace.status || "—"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ─── Supervisor Panel ──────────────────────────────────────────────────────── */
function SupervisorPanel({ supervisor }: { supervisor: SupervisorData | null }) {
  const escalations = Array.isArray(supervisor?.escalations)
    ? supervisor!.escalations.length
    : typeof supervisor?.escalations === "number"
    ? supervisor.escalations
    : 0;

  const recoveries = Array.isArray(supervisor?.recoveries)
    ? supervisor!.recoveries.length
    : typeof supervisor?.recoveries === "number"
    ? supervisor.recoveries
    : 0;

  const meshNodes = Array.isArray(supervisor?.meshNodes) ? supervisor!.meshNodes.length : 0;
  const workers = supervisor?.workers ?? meshNodes;
  const state = supervisor?.state || "unknown";
  const autoheal = supervisor?.autoheal ?? false;

  const stats = [
    { label: "Workers", value: String(workers) },
    { label: "Escalations", value: String(escalations) },
    { label: "Recoveries", value: String(recoveries) },
    { label: "Mesh nodes", value: String(meshNodes || "—") },
    { label: "State", value: state },
    { label: "Auto-heal", value: autoheal ? "on" : "off" },
  ];

  return (
    <div className="glass-card p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Server className="size-5" style={{ color: "var(--accent)" }} />
        <h3 className="text-base font-semibold text-[var(--foreground)]">Supervisor</h3>
        <span
          className="rounded-full px-2 py-0.5 text-xs font-medium"
          style={{
            background:
              state === "stable" || state === "healthy"
                ? "rgba(34,197,94,0.12)"
                : "rgba(90,196,255,0.10)",
            border:
              state === "stable" || state === "healthy"
                ? "1px solid rgba(34,197,94,0.26)"
                : "1px solid rgba(90,196,255,0.20)",
            color:
              state === "stable" || state === "healthy"
                ? "var(--status-green)"
                : "var(--accent)",
          }}
        >
          {state}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {stats.map(({ label, value }) => (
          <div
            key={label}
            className="rounded-xl p-3 text-center"
            style={{ background: "rgba(255,255,255,0.04)" }}
          >
            <p className="text-sm font-semibold text-[var(--foreground)]">{value}</p>
            <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">{label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Security Panel ────────────────────────────────────────────────────────── */
function SecurityPanel({ security }: { security: SecurityItem[] }) {
  function securityBadge(item: SecurityItem) {
    const sev = item.severity || item.status || "info";
    const style = severityStyle(sev);
    return style;
  }

  return (
    <div className="glass-card p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Shield className="size-5" style={{ color: "var(--accent)" }} />
        <h3 className="text-base font-semibold text-[var(--foreground)]">Security</h3>
        {security.length > 0 && <span className="pill-cyan">{security.length}</span>}
      </div>

      {security.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-6 text-center">
          <Shield className="size-8" style={{ color: "var(--status-green)" }} />
          <p className="text-sm text-[var(--muted-foreground)]">No security items to review.</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
          {security.map((item, i) => {
            const badge = securityBadge(item);
            return (
              <div
                key={item.id || i}
                className="flex items-center justify-between gap-3 rounded-xl px-3 py-2.5"
                style={{ background: "rgba(255,255,255,0.04)" }}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-[var(--foreground)] truncate">
                    {item.name || item.label || `Item #${i + 1}`}
                  </p>
                  {item.type && (
                    <p className="text-xs text-[var(--muted-foreground)]">{item.type}</p>
                  )}
                </div>
                <span
                  className="shrink-0 rounded-full px-2 py-0.5 text-xs font-medium"
                  style={{
                    background: badge.bg,
                    border: `1px solid ${badge.border}`,
                    color: badge.color,
                  }}
                >
                  {item.severity || item.status || "info"}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Static policy badges always shown */}
      <div className="flex flex-wrap gap-2 pt-1">
        <span
          className="rounded-full px-3 py-1 text-xs"
          style={{
            background: "rgba(34,197,94,0.10)",
            border: "1px solid rgba(34,197,94,0.22)",
            color: "var(--status-green)",
          }}
        >
          PKI active
        </span>
        <span
          className="rounded-full px-3 py-1 text-xs"
          style={{
            background: "rgba(234,179,8,0.10)",
            border: "1px solid rgba(234,179,8,0.22)",
            color: "var(--status-yellow)",
          }}
        >
          Regex filter on
        </span>
        <span
          className="rounded-full px-3 py-1 text-xs"
          style={{
            background: "rgba(90,196,255,0.10)",
            border: "1px solid rgba(90,196,255,0.22)",
            color: "var(--accent)",
          }}
        >
          Privacy mask on
        </span>
      </div>
    </div>
  );
}

/* ─── Main Shell ──────────────────────────────────────────────────────────── */
export function ControlPlaneShell({
  health,
  incidents,
  supervisor,
  traces,
  security,
  metrics,
}: ControlPlaneShellProps) {
  const healthData = health as HealthData | null;
  const incidentList: IncidentRecord[] = Array.isArray(
    (incidents as { incidents?: unknown[] })?.incidents
  )
    ? (incidents as { incidents: IncidentRecord[] }).incidents
    : Array.isArray(incidents)
    ? (incidents as IncidentRecord[])
    : [];

  const traceList: TraceRecord[] = Array.isArray(
    (traces as { traces?: unknown[] })?.traces
  )
    ? (traces as { traces: TraceRecord[] }).traces
    : Array.isArray(traces)
    ? (traces as TraceRecord[])
    : [];

  const securityList: SecurityItem[] = Array.isArray(
    (security as { items?: unknown[] })?.items
  )
    ? (security as { items: SecurityItem[] }).items
    : Array.isArray(security)
    ? (security as SecurityItem[])
    : [];

  const supervisorData = supervisor as SupervisorData | null;
  const metricsData = metrics as MetricsData | null;

  return (
    <div className="space-y-4 xl:space-y-6">
      {/* 3-column layout on xl */}
      <div className="grid gap-4 xl:grid-cols-3 xl:gap-6">
        {/* Column 1: Health + Metrics */}
        <div className="space-y-4">
          <HealthPanel health={healthData} />
          <MetricsPanel metrics={metricsData} />
        </div>

        {/* Column 2: Incidents + Traces */}
        <div className="space-y-4">
          <IncidentsPanel incidents={incidentList} />
          <TracesPanel traces={traceList} />
        </div>

        {/* Column 3: Supervisor + Security */}
        <div className="space-y-4">
          <SupervisorPanel supervisor={supervisorData} />
          <SecurityPanel security={securityList} />
        </div>
      </div>
    </div>
  );
}
