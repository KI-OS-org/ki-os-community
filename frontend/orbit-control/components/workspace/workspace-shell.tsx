"use client";

import { useState, useRef, useEffect } from "react";
import {
  Clock,
  Database,
  FileText,
  Play,
  Tag,
  Upload,
  CheckCircle,
  AlertTriangle,
  Loader2,
  Brain,
  ShieldCheck,
  User,
  RefreshCw,
} from "lucide-react";

/* ─── Types ────────────────────────────────────────────────────────────────── */
interface RunRecord {
  runId?: string;
  id?: string;
  status?: string;
  model?: string;
  createdAt?: string;
  timestamp?: string;
  goal?: string;
  duration?: number;
}

interface FileRecord {
  id?: string;
  name?: string;
  type?: string;
  mimeType?: string;
  size?: number;
  tags?: string[];
  createdAt?: string;
}

interface WorkspaceData {
  name?: string;
  role?: string;
  memoryHits?: Array<{ key: string; value: string; score?: number }>;
  description?: string;
}

interface WorkspaceShellProps {
  workspace: unknown;
  runs: unknown[];
  files: unknown[];
}

/* ─── Helpers ───────────────────────────────────────────────────────────────── */
function statusColor(status: string | undefined): string {
  switch (status?.toLowerCase()) {
    case "completed":
    case "done":
    case "success":
      return "var(--status-green)";
    case "failed":
    case "error":
      return "var(--status-red)";
    case "running":
    case "pending":
      return "var(--status-yellow)";
    default:
      return "var(--status-blue)";
  }
}

function statusDotClass(status: string | undefined): string {
  switch (status?.toLowerCase()) {
    case "completed":
    case "done":
    case "success":
      return "status-dot green";
    case "failed":
    case "error":
      return "status-dot red";
    case "running":
      return "status-dot yellow";
    default:
      return "status-dot blue";
  }
}

function StatusIcon({ status }: { status: string | undefined }) {
  switch (status?.toLowerCase()) {
    case "completed":
    case "done":
    case "success":
      return <CheckCircle className="size-4" style={{ color: "var(--status-green)" }} />;
    case "failed":
    case "error":
      return <AlertTriangle className="size-4" style={{ color: "var(--status-red)" }} />;
    case "running":
      return <Loader2 className="size-4 animate-spin" style={{ color: "var(--status-yellow)" }} />;
    default:
      return <Play className="size-4" style={{ color: "var(--status-blue)" }} />;
  }
}

function formatBytes(bytes: number | undefined): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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

/* ─── Sub-components ────────────────────────────────────────────────────────── */
function FileCard({ file }: { file: FileRecord }) {
  return (
    <div className="glass-card p-4">
      <div className="flex items-start gap-3">
        <div
          className="flex size-10 shrink-0 items-center justify-center rounded-xl"
          style={{ background: "rgba(90,196,255,0.10)", border: "1px solid rgba(90,196,255,0.18)" }}
        >
          <FileText className="size-5" style={{ color: "var(--accent)" }} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-[var(--foreground)]">{file.name || "Unnamed file"}</p>
          <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">
            {file.type || file.mimeType || "unknown"} · {formatBytes(file.size)}
          </p>
          {file.tags && file.tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {file.tags.map((tag) => (
                <span key={tag} className="pill-cyan text-xs">
                  <Tag className="size-2.5" />
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
      {file.createdAt && (
        <p className="mt-3 text-xs text-[var(--muted-foreground)]">
          <Clock className="mr-1 inline size-3" />
          {formatDate(file.createdAt)}
        </p>
      )}
    </div>
  );
}

function RunCard({ run }: { run: RunRecord }) {
  const runId = run.runId || run.id || "—";
  const status = run.status || "unknown";
  const timestamp = run.createdAt || run.timestamp;

  return (
    <div className="glass-card p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <StatusIcon status={status} />
          <div>
            <p className="text-sm font-medium text-[var(--foreground)]">
              Run <span style={{ color: "var(--accent)" }}>#{String(runId).slice(-8)}</span>
            </p>
            {run.goal && (
              <p className="mt-0.5 max-w-xs truncate text-xs text-[var(--muted-foreground)]">{run.goal}</p>
            )}
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span
            className="rounded-full px-2 py-0.5 text-xs font-medium"
            style={{
              background: `${statusColor(status)}18`,
              color: statusColor(status),
              border: `1px solid ${statusColor(status)}33`,
            }}
          >
            {status}
          </span>
          {run.model && (
            <span className="text-xs text-[var(--muted-foreground)]">{run.model}</span>
          )}
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between text-xs text-[var(--muted-foreground)]">
        <span>
          <Clock className="mr-1 inline size-3" />
          {formatDate(timestamp)}
        </span>
        {run.duration !== undefined && <span>{run.duration}ms</span>}
      </div>
    </div>
  );
}

function MemoryHitCard({ hit }: { hit: { key: string; value: string; score?: number } }) {
  return (
    <div className="glass-card p-4">
      <div className="flex items-start gap-3">
        <Brain className="mt-0.5 size-4 shrink-0" style={{ color: "var(--accent)" }} />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium" style={{ color: "var(--accent)" }}>{hit.key}</p>
          <p className="mt-1 text-sm text-[var(--foreground)] line-clamp-2">{hit.value}</p>
          {hit.score !== undefined && (
            <p className="mt-1 text-xs text-[var(--muted-foreground)]">score: {hit.score.toFixed(3)}</p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Main Shell ──────────────────────────────────────────────────────────── */
export function WorkspaceShell({ workspace, runs, files }: WorkspaceShellProps) {
  const ws = workspace as WorkspaceData | null;
  const runList = (runs || []) as RunRecord[];
  const fileList = (files || []) as FileRecord[];
  const memoryHits = ws?.memoryHits || [];

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadStatus, setUploadStatus] = useState<"idle" | "uploading" | "done" | "error">("idle");
  const [uploadedFileName, setUploadedFileName] = useState<string>("");

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadStatus("uploading");
    setUploadedFileName(file.name);

    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/files/upload", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error("Upload failed");
      setUploadStatus("done");
    } catch {
      setUploadStatus("error");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-4 xl:space-y-6">
      {/* Files + Memory grid */}
      <div className="grid gap-4 xl:grid-cols-2">
        {/* Files Panel */}
        <section className="rounded-[32px] border border-white/10 bg-black/20 p-5 backdrop-blur">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Database className="size-5" style={{ color: "var(--accent)" }} />
              <h2 className="text-lg font-semibold text-[var(--foreground)]">Files</h2>
              {fileList.length > 0 && (
                <span className="pill-cyan">{fileList.length}</span>
              )}
            </div>
            <div>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={handleFileChange}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadStatus === "uploading"}
                className="flex items-center gap-2 rounded-[20px] px-4 py-2 text-sm font-medium transition-all"
                style={{
                  background: "rgba(90,196,255,0.10)",
                  border: "1px solid rgba(90,196,255,0.22)",
                  color: "var(--accent)",
                }}
              >
                {uploadStatus === "uploading" ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Upload className="size-4" />
                )}
                {uploadStatus === "uploading" ? "Uploading…" : "Upload"}
              </button>
            </div>
          </div>

          {uploadStatus === "done" && (
            <div
              className="mb-3 rounded-xl p-3 text-sm"
              style={{
                background: "rgba(34,197,94,0.10)",
                border: "1px solid rgba(34,197,94,0.22)",
                color: "var(--status-green)",
              }}
            >
              <CheckCircle className="mr-2 inline size-4" />
              {uploadedFileName} uploaded successfully.
            </div>
          )}
          {uploadStatus === "error" && (
            <div
              className="mb-3 rounded-xl p-3 text-sm"
              style={{
                background: "rgba(248,113,113,0.10)",
                border: "1px solid rgba(248,113,113,0.22)",
                color: "var(--status-red)",
              }}
            >
              <AlertTriangle className="mr-2 inline size-4" />
              Upload failed. Please try again.
            </div>
          )}

          {fileList.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
              <FileText className="size-10 opacity-30" />
              <p className="text-sm text-[var(--muted-foreground)]">No files yet. Upload your first file.</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {fileList.map((file, i) => (
                <FileCard key={file.id || i} file={file} />
              ))}
            </div>
          )}
        </section>

        {/* Memory Panel */}
        <section className="rounded-[32px] border border-white/10 bg-black/20 p-5 backdrop-blur">
          <div className="mb-4 flex items-center gap-2">
            <Brain className="size-5" style={{ color: "var(--accent)" }} />
            <h2 className="text-lg font-semibold text-[var(--foreground)]">Memory</h2>
            {memoryHits.length > 0 && (
              <span className="pill-cyan">{memoryHits.length} hits</span>
            )}
          </div>

          {memoryHits.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
              <Brain className="size-10 opacity-30" />
              <p className="text-sm text-[var(--muted-foreground)]">No memory hits for this workspace.</p>
              <p className="max-w-xs text-xs text-[var(--muted-foreground)]">
                Memory is populated as you run tasks and the agent learns from your work.
              </p>
            </div>
          ) : (
            <div className="grid gap-3">
              {memoryHits.map((hit, i) => (
                <MemoryHitCard key={i} hit={hit} />
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Recent Runs */}
      <section className="rounded-[32px] border border-white/10 bg-black/20 p-5 backdrop-blur">
        <div className="mb-4 flex items-center gap-2">
          <Play className="size-5" style={{ color: "var(--accent)" }} />
          <h2 className="text-lg font-semibold text-[var(--foreground)]">Recent Runs</h2>
          {runList.length > 0 && (
            <span className="pill-cyan">{runList.length}</span>
          )}
        </div>

        {runList.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
            <Play className="size-10 opacity-30" />
            <p className="text-sm text-[var(--muted-foreground)]">No runs yet. Start a task above to create your first run.</p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {runList.map((run, i) => (
              <RunCard key={run.runId || run.id || i} run={run} />
            ))}
          </div>
        )}
      </section>

      {/* Whiteboard Preview Link */}
      <section className="rounded-[32px] border border-white/10 bg-black/20 p-5 backdrop-blur">
        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-[var(--foreground)]">Whiteboard</h2>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">
              Visual workspace for diagrams, notes and collaborative thinking.
            </p>
          </div>
          <a
            href="/whiteboard"
            className="flex items-center gap-2 rounded-[20px] px-5 py-2.5 text-sm font-medium transition-all"
            style={{
              background: "rgba(90,196,255,0.10)",
              border: "1px solid rgba(90,196,255,0.22)",
              color: "var(--accent)",
            }}
          >
            Open Whiteboard
          </a>
        </div>
      </section>

      {/* Roles Panel */}
      <WorkspaceRolesPanel />
    </div>
  );
}

/* ─── Workspace Roles Panel ─────────────────────────────────────────────────── */

type WorkspaceRole = "operator" | "user" | "whiteboard";

interface WorkspaceContext {
  role?: WorkspaceRole | string;
  userId?: string;
  tenantId?: string;
  workspaceId?: string;
  permissions?: string[];
  [key: string]: unknown;
}

function WorkspaceRolesPanel() {
  const [context, setContext] = useState<WorkspaceContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeRole, setActiveRole] = useState<WorkspaceRole>("user");

  const ROLES: Array<{
    id: WorkspaceRole;
    label: string;
    description: string;
    color: string;
  }> = [
    {
      id: "operator",
      label: "Operator",
      description: "Full control — configure agents, manage flows and system settings.",
      color: "#a855f7",
    },
    {
      id: "user",
      label: "User",
      description: "Standard access — run tasks, view results and interact with agents.",
      color: "#5ac4ff",
    },
    {
      id: "whiteboard",
      label: "Whiteboard",
      description: "Visual collaboration mode — diagrams, notes and brainstorming.",
      color: "#22c55e",
    },
  ];

  const fetchContext = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/workspace/context").catch(() => null);
      if (!res) return;
      const json = await res.json().catch(() => ({}));
      const ctx: WorkspaceContext = json?.context ?? json;
      setContext(ctx);
      if (ctx?.role) setActiveRole(ctx.role as WorkspaceRole);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContext();
  }, []);

  return (
    <section className="rounded-[32px] border border-white/10 bg-black/20 p-5 backdrop-blur">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-5" style={{ color: "var(--accent)" }} />
          <h2 className="text-lg font-semibold text-[var(--foreground)]">Workspace Roles</h2>
        </div>
        <button
          onClick={fetchContext}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs transition-opacity hover:opacity-70"
          style={{
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.1)",
            color: "var(--muted-foreground)",
          }}
        >
          <RefreshCw className="size-3" />
          Refresh
        </button>
      </div>

      {/* Context info */}
      {!loading && context && (
        <div
          className="mb-4 rounded-xl px-4 py-3 flex flex-wrap gap-4 text-xs"
          style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.07)",
          }}
        >
          {context.userId && (
            <span className="flex items-center gap-1 text-[var(--muted-foreground)]">
              <User className="size-3" />
              {context.userId}
            </span>
          )}
          {context.tenantId && (
            <span className="text-[var(--muted-foreground)]">
              Tenant: <span className="text-[var(--foreground)]">{context.tenantId}</span>
            </span>
          )}
          {context.workspaceId && (
            <span className="text-[var(--muted-foreground)]">
              WS: <span className="text-[var(--foreground)] font-mono">{context.workspaceId}</span>
            </span>
          )}
          {Array.isArray(context.permissions) && context.permissions.length > 0 && (
            <span className="text-[var(--muted-foreground)]">
              Permissions: <span className="text-[var(--foreground)]">{context.permissions.join(", ")}</span>
            </span>
          )}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="size-5 animate-spin" style={{ color: "var(--accent)" }} />
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-3">
          {ROLES.map((role) => {
            const isActive = activeRole === role.id;
            return (
              <button
                key={role.id}
                onClick={() => setActiveRole(role.id)}
                className="rounded-xl p-4 text-left transition-all"
                style={{
                  background: isActive ? `${role.color}10` : "rgba(255,255,255,0.03)",
                  border: `1px solid ${isActive ? role.color + "40" : "rgba(255,255,255,0.08)"}`,
                }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <ShieldCheck
                    className="size-4 shrink-0"
                    style={{ color: isActive ? role.color : "var(--muted-foreground)" }}
                  />
                  <span
                    className="text-sm font-semibold"
                    style={{ color: isActive ? role.color : "var(--foreground)" }}
                  >
                    {role.label}
                  </span>
                  {isActive && (
                    <span
                      className="ml-auto rounded-full px-2 py-0.5 text-xs font-medium"
                      style={{
                        background: `${role.color}18`,
                        border: `1px solid ${role.color}33`,
                        color: role.color,
                      }}
                    >
                      Active
                    </span>
                  )}
                </div>
                <p className="text-xs text-[var(--muted-foreground)] leading-relaxed">
                  {role.description}
                </p>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
