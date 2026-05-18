"use client";

import { useEffect, useState } from "react";
import { Building2, Loader2, RefreshCw, Users } from "lucide-react";
import { cn } from "@/lib/utils";

type Tenant = {
  id: string;
  name: string;
  status: string;
  plan?: string;
  userCount?: number;
  workspaceCount?: number;
};

const DEMO_TENANTS: Tenant[] = [
  { id: "demo-tenant", name: "Demo Tenant", status: "active", plan: "enterprise", userCount: 12, workspaceCount: 4 },
  { id: "ops-tenant", name: "Ops Tenant", status: "active", plan: "pro", userCount: 5, workspaceCount: 2 },
  { id: "audit-tenant", name: "Audit Tenant", status: "active", plan: "standard", userCount: 3, workspaceCount: 1 },
  { id: "retail-tenant", name: "Retail Tenant", status: "inactive", plan: "standard", userCount: 0, workspaceCount: 0 },
];

const statusColors: Record<string, string> = {
  active: "text-emerald-300 bg-emerald-500/10 border-emerald-500/20",
  inactive: "text-[var(--muted-foreground)] bg-white/5 border-white/10",
  suspended: "text-red-300 bg-red-500/10 border-red-500/20",
};

export function TenantOverview() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/tenants", { cache: "no-store" });
      if (!res.ok) throw new Error();
      const data = await res.json();
      const list: Tenant[] = Array.isArray(data) ? data : Array.isArray(data?.tenants) ? data.tenants : [];
      setTenants(list.length ? list : DEMO_TENANTS);
    } catch {
      setTenants(DEMO_TENANTS);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="rounded-[32px] border border-white/10 bg-black/20 p-5 backdrop-blur">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Tenant Overview</h2>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            Alle Tenants auf einen Blick.
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm transition hover:border-[rgba(90,196,255,0.3)] hover:bg-[rgba(90,196,255,0.08)] disabled:opacity-50"
        >
          <RefreshCw className={cn("size-4", loading && "animate-spin")} />
          Aktualisieren
        </button>
      </div>

      <div className="mt-4 space-y-3">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-[var(--muted-foreground)]">
            <Loader2 className="size-4 animate-spin" />
            Tenants laden…
          </div>
        ) : (
          tenants.map((tenant) => (
            <div
              key={tenant.id}
              className="flex flex-wrap items-center gap-3 rounded-[20px] border border-white/10 bg-white/4 p-4"
            >
              <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-white/6 text-[var(--muted-foreground)]">
                <Building2 className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{tenant.name}</span>
                  <span
                    className={cn(
                      "rounded-full border px-2 py-0.5 text-[10px] capitalize",
                      statusColors[tenant.status] ?? statusColors.inactive,
                    )}
                  >
                    {tenant.status}
                  </span>
                  {tenant.plan && (
                    <span className="rounded-full border border-[rgba(90,196,255,0.2)] bg-[rgba(90,196,255,0.06)] px-2 py-0.5 text-[10px] text-[var(--accent)]">
                      {tenant.plan}
                    </span>
                  )}
                </div>
                <p className="mt-0.5 font-mono text-xs text-[var(--muted-foreground)]">
                  {tenant.id}
                </p>
              </div>
              <div className="flex items-center gap-4 text-xs text-[var(--muted-foreground)]">
                {tenant.userCount !== undefined && (
                  <span className="flex items-center gap-1">
                    <Users className="size-3.5" />
                    {tenant.userCount}
                  </span>
                )}
                {tenant.workspaceCount !== undefined && (
                  <span className="flex items-center gap-1">
                    <Building2 className="size-3.5" />
                    {tenant.workspaceCount}
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
