"use client";

import { useState } from "react";
import { GitBranch, Play, CheckCircle, AlertTriangle, Loader2, Zap } from "lucide-react";

interface DagRecord {
  id?: string;
  dagId?: string;
  name?: string;
  description?: string;
  nodes?: unknown[];
  nodeCount?: number;
  status?: string;
  createdAt?: string;
}

interface ExecutionResult {
  ok: boolean;
  data?: unknown;
  error?: string;
}

function NodesBadge({ count }: { count: number | undefined }) {
  if (count === undefined || count === null) return null;
  return (
    <span
      className="rounded-full px-2 py-0.5 text-xs"
      style={{
        background: "rgba(90,196,255,0.10)",
        border: "1px solid rgba(90,196,255,0.22)",
        color: "var(--accent)",
      }}
    >
      {count} node{count !== 1 ? "s" : ""}
    </span>
  );
}

function ExecutionResultBlock({ result }: { result: ExecutionResult }) {
  if (result.ok) {
    return (
      <div
        className="mt-3 rounded-xl p-3 text-xs font-mono"
        style={{
          background: "rgba(34,197,94,0.08)",
          border: "1px solid rgba(34,197,94,0.22)",
          color: "var(--status-green)",
        }}
      >
        <CheckCircle className="mr-1.5 inline size-3.5" />
        Execution started.
        {result.data !== undefined && result.data !== null && (
          <pre className="mt-2 overflow-auto text-[10px] text-[var(--muted-foreground)]">
            {JSON.stringify(result.data, null, 2)}
          </pre>
        )}
      </div>
    );
  }
  return (
    <div
      className="mt-3 rounded-xl p-3 text-xs"
      style={{
        background: "rgba(248,113,113,0.08)",
        border: "1px solid rgba(248,113,113,0.22)",
        color: "var(--status-red)",
      }}
    >
      <AlertTriangle className="mr-1.5 inline size-3.5" />
      {result.error || "Execution failed."}
    </div>
  );
}

function DagCard({ dag }: { dag: DagRecord }) {
  const dagId = dag.id || dag.dagId || "";
  const nodeCount =
    typeof dag.nodeCount === "number"
      ? dag.nodeCount
      : Array.isArray(dag.nodes)
      ? dag.nodes.length
      : undefined;

  const [executing, setExecuting] = useState(false);
  const [result, setResult] = useState<ExecutionResult | null>(null);

  async function handleExecute() {
    setExecuting(true);
    setResult(null);
    try {
      const res = await fetch("/api/flows/test-run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ dagId }),
      });
      const data = await res.json().catch(() => null);
      setResult({ ok: res.ok, data });
    } catch (err) {
      setResult({ ok: false, error: err instanceof Error ? err.message : "Network error" });
    } finally {
      setExecuting(false);
    }
  }

  return (
    <div className="glass-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div
            className="flex size-10 shrink-0 items-center justify-center rounded-xl"
            style={{ background: "rgba(90,196,255,0.10)", border: "1px solid rgba(90,196,255,0.18)" }}
          >
            <GitBranch className="size-5" style={{ color: "var(--accent)" }} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[var(--foreground)]">
              {dag.name || dagId || "Unnamed DAG"}
            </p>
            <p className="mt-0.5 text-xs text-[var(--muted-foreground)] font-mono">
              {dagId}
            </p>
            {dag.description && (
              <p className="mt-1 text-xs text-[var(--muted-foreground)] line-clamp-2">
                {dag.description}
              </p>
            )}
            <div className="mt-2">
              <NodesBadge count={nodeCount} />
            </div>
          </div>
        </div>
        <button
          onClick={handleExecute}
          disabled={executing || !dagId}
          className="flex shrink-0 items-center gap-2 rounded-[16px] px-3 py-2 text-xs font-medium transition-all disabled:opacity-50"
          style={{
            background: executing
              ? "rgba(90,196,255,0.05)"
              : "rgba(90,196,255,0.12)",
            border: "1px solid rgba(90,196,255,0.28)",
            color: "var(--accent)",
          }}
        >
          {executing ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Play className="size-3.5" />
          )}
          {executing ? "Running…" : "Execute"}
        </button>
      </div>

      {result && <ExecutionResultBlock result={result} />}
    </div>
  );
}

export function DagRegistryPanel({ dags }: { dags: unknown[] }) {
  const dagList = (dags || []) as DagRecord[];

  return (
    <section className="rounded-[32px] border border-white/10 bg-black/20 p-5 backdrop-blur">
      <div className="mb-4 flex items-center gap-2">
        <GitBranch className="size-5" style={{ color: "var(--accent)" }} />
        <h2 className="text-lg font-semibold text-[var(--foreground)]">DAG Registry</h2>
        {dagList.length > 0 && <span className="pill-cyan">{dagList.length} DAGs</span>}
      </div>

      {dagList.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
          <GitBranch className="size-10 opacity-30" />
          <p className="text-sm text-[var(--muted-foreground)]">No DAGs registered yet.</p>
          <p className="max-w-xs text-xs text-[var(--muted-foreground)]">
            Create your first DAG in the Flow Studio below, or register one via the API.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {dagList.map((dag, i) => (
            <DagCard key={(dag as DagRecord).id || (dag as DagRecord).dagId || i} dag={dag} />
          ))}
        </div>
      )}
    </section>
  );
}

export function LiveExecutionPanel({ live }: { live: unknown }) {
  const executions = Array.isArray((live as { executions?: unknown[] })?.executions)
    ? (live as { executions: unknown[] }).executions
    : Array.isArray(live)
    ? (live as unknown[])
    : [];

  return (
    <section className="rounded-[32px] border border-white/10 bg-black/20 p-5 backdrop-blur">
      <div className="mb-4 flex items-center gap-2">
        <Zap className="size-5" style={{ color: "var(--accent)" }} />
        <h2 className="text-lg font-semibold text-[var(--foreground)]">Live Execution</h2>
        {executions.length > 0 && (
          <span
            className="rounded-full px-2 py-0.5 text-xs font-medium"
            style={{
              background: "rgba(34,197,94,0.12)",
              border: "1px solid rgba(34,197,94,0.28)",
              color: "var(--status-green)",
            }}
          >
            {executions.length} active
          </span>
        )}
      </div>

      {executions.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
          <Zap className="size-8 opacity-30" />
          <p className="text-sm text-[var(--muted-foreground)]">No executions currently running.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {executions.map((exec, i) => {
            const e = exec as {
              id?: string;
              dagId?: string;
              status?: string;
              startedAt?: string;
              progress?: number;
            };
            return (
              <div key={e.id || i} className="glass-card p-4">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-[var(--foreground)]">
                      {e.dagId || e.id || `Execution #${i + 1}`}
                    </p>
                    {e.startedAt && (
                      <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">
                        Started {new Date(e.startedAt).toLocaleTimeString("de-DE")}
                      </p>
                    )}
                  </div>
                  <span
                    className="rounded-full px-2 py-0.5 text-xs font-medium"
                    style={{
                      background:
                        e.status === "running" ? "rgba(90,196,255,0.12)" : "rgba(90,196,255,0.06)",
                      border: "1px solid rgba(90,196,255,0.22)",
                      color: "var(--accent)",
                    }}
                  >
                    {e.status || "running"}
                  </span>
                </div>
                {typeof e.progress === "number" && (
                  <div className="mt-3">
                    <div
                      className="h-1.5 overflow-hidden rounded-full"
                      style={{ background: "rgba(255,255,255,0.08)" }}
                    >
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${Math.min(100, e.progress)}%`,
                          background: "linear-gradient(90deg,var(--accent),#4a8dff)",
                        }}
                      />
                    </div>
                    <p className="mt-1 text-right text-xs text-[var(--muted-foreground)]">
                      {e.progress}%
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
