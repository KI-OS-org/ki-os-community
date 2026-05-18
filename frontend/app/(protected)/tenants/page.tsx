"use client";

import { useState, useEffect, useCallback, useTransition } from "react";
import {
  AlertCircle,
  Building2,
  Check,
  ChevronDown,
  ChevronUp,
  Edit2,
  Loader2,
  Plus,
  RefreshCw,
  Users,
  X,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

type TenantPlan = "starter" | "professional" | "enterprise";
type TenantStatus = "active" | "suspended" | "trial" | "inactive" | string;

interface Tenant {
  id: string;
  tenantId?: string;
  name: string;
  domain?: string;
  plan?: TenantPlan | string;
  status?: TenantStatus;
  maxUsers?: number;
  billingEmail?: string;
  createdAt?: string;
  config?: Record<string, unknown>;
  billing?: Record<string, unknown>;
  isolation?: Record<string, unknown>;
  [key: string]: unknown;
}

interface TenantFormData {
  name: string;
  domain: string;
  plan: TenantPlan;
  maxUsers: string;
  billingEmail: string;
}

const DEFAULT_FORM: TenantFormData = {
  name: "",
  domain: "",
  plan: "starter",
  maxUsers: "10",
  billingEmail: "",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function tenantId(t: Tenant) {
  return t.tenantId ?? t.id ?? "";
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("de-DE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function statusStyle(status: TenantStatus | undefined) {
  switch ((status ?? "").toLowerCase()) {
    case "active":
      return { bg: "rgba(34,197,94,0.1)", border: "rgba(34,197,94,0.25)", color: "#22c55e" };
    case "trial":
      return { bg: "rgba(90,196,255,0.1)", border: "rgba(90,196,255,0.25)", color: "#5ac4ff" };
    case "suspended":
      return { bg: "rgba(248,113,113,0.1)", border: "rgba(248,113,113,0.25)", color: "#f87171" };
    default:
      return { bg: "rgba(113,113,122,0.1)", border: "rgba(113,113,122,0.25)", color: "#71717a" };
  }
}

function planStyle(plan: string | undefined) {
  switch ((plan ?? "").toLowerCase()) {
    case "enterprise":
      return { color: "#a855f7" };
    case "professional":
      return { color: "#5ac4ff" };
    default:
      return { color: "#eab308" };
  }
}

// ── TenantForm ────────────────────────────────────────────────────────────────

function TenantForm({
  initial,
  onSubmit,
  onClose,
  submitting,
  title,
}: {
  initial: TenantFormData;
  onSubmit: (data: TenantFormData) => void;
  onClose: () => void;
  submitting: boolean;
  title: string;
}) {
  const [form, setForm] = useState<TenantFormData>(initial);

  const set = (key: keyof TenantFormData, val: string) =>
    setForm((f) => ({ ...f, [key]: val }));

  return (
    <div
      className="glass-card p-5 space-y-4"
      style={{ borderLeft: "3px solid var(--accent)" }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Building2 className="size-4" style={{ color: "var(--accent)" }} />
          <h3 className="font-semibold text-sm text-[var(--foreground)]">{title}</h3>
        </div>
        <button onClick={onClose} className="rounded-lg p-1 hover:opacity-60">
          <X className="size-4 text-[var(--muted-foreground)]" />
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {/* Name */}
        <div>
          <label className="block text-xs text-[var(--muted-foreground)] mb-1">
            Name *
          </label>
          <input
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="Acme Corp"
            className="w-full rounded-xl px-3 py-2 text-sm outline-none"
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "var(--foreground)",
            }}
          />
        </div>

        {/* Domain */}
        <div>
          <label className="block text-xs text-[var(--muted-foreground)] mb-1">
            Domain
          </label>
          <input
            value={form.domain}
            onChange={(e) => set("domain", e.target.value)}
            placeholder="acme.com"
            className="w-full rounded-xl px-3 py-2 text-sm outline-none"
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "var(--foreground)",
            }}
          />
        </div>

        {/* Plan */}
        <div>
          <label className="block text-xs text-[var(--muted-foreground)] mb-1">
            Plan
          </label>
          <select
            value={form.plan}
            onChange={(e) => set("plan", e.target.value as TenantPlan)}
            className="w-full rounded-xl px-3 py-2 text-sm outline-none"
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "var(--foreground)",
            }}
          >
            <option value="starter">Starter</option>
            <option value="professional">Professional</option>
            <option value="enterprise">Enterprise</option>
          </select>
        </div>

        {/* Max Users */}
        <div>
          <label className="block text-xs text-[var(--muted-foreground)] mb-1">
            Max Users
          </label>
          <input
            type="number"
            value={form.maxUsers}
            onChange={(e) => set("maxUsers", e.target.value)}
            min="1"
            className="w-full rounded-xl px-3 py-2 text-sm outline-none"
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "var(--foreground)",
            }}
          />
        </div>

        {/* Billing Email */}
        <div className="sm:col-span-2">
          <label className="block text-xs text-[var(--muted-foreground)] mb-1">
            Billing Email
          </label>
          <input
            type="email"
            value={form.billingEmail}
            onChange={(e) => set("billingEmail", e.target.value)}
            placeholder="billing@acme.com"
            className="w-full rounded-xl px-3 py-2 text-sm outline-none"
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "var(--foreground)",
            }}
          />
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <button
          onClick={onClose}
          className="rounded-lg px-4 py-2 text-xs text-[var(--muted-foreground)] hover:opacity-60"
        >
          Cancel
        </button>
        <button
          onClick={() => form.name.trim() && onSubmit(form)}
          disabled={!form.name.trim() || submitting}
          className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-medium disabled:opacity-50"
          style={{
            background: "rgba(90,196,255,0.15)",
            border: "1px solid rgba(90,196,255,0.3)",
            color: "var(--accent)",
          }}
        >
          <Check className="size-3.5" />
          {submitting ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}

// ── TenantRow ─────────────────────────────────────────────────────────────────

function TenantRow({
  tenant,
  onEdit,
}: {
  tenant: Tenant;
  onEdit: (t: Tenant) => void;
}) {
  const [open, setOpen] = useState(false);
  const ss = statusStyle(tenant.status);
  const ps = planStyle(tenant.plan);

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.07)",
      }}
    >
      <button
        className="w-full flex items-center gap-3 px-5 py-4 text-left"
        onClick={() => setOpen((v) => !v)}
      >
        <Building2 className="size-4 shrink-0 text-[var(--muted-foreground)]" />

        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-[var(--foreground)]">{tenant.name}</p>
          {tenant.domain && (
            <p className="text-xs text-[var(--muted-foreground)] font-mono">
              {tenant.domain}
            </p>
          )}
        </div>

        {/* Plan */}
        <span className="text-xs font-semibold capitalize" style={{ color: ps.color }}>
          {tenant.plan ?? "—"}
        </span>

        {/* Status */}
        <span
          className="shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium capitalize"
          style={{ background: ss.bg, border: `1px solid ${ss.border}`, color: ss.color }}
        >
          {tenant.status ?? "unknown"}
        </span>

        {/* Max users */}
        <span className="hidden sm:flex items-center gap-1 text-xs text-[var(--muted-foreground)] shrink-0">
          <Users className="size-3" />
          {tenant.maxUsers ?? "—"}
        </span>

        {/* Created */}
        <span className="hidden md:block text-xs text-[var(--muted-foreground)] shrink-0">
          {fmtDate(tenant.createdAt)}
        </span>

        {open ? (
          <ChevronUp className="size-4 shrink-0 text-[var(--muted-foreground)]" />
        ) : (
          <ChevronDown className="size-4 shrink-0 text-[var(--muted-foreground)]" />
        )}
      </button>

      {open && (
        <div
          className="px-5 pb-5 space-y-4 border-t"
          style={{ borderColor: "rgba(255,255,255,0.06)" }}
        >
          <div className="flex justify-end mt-3">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit(tenant);
              }}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium"
              style={{
                background: "rgba(90,196,255,0.1)",
                border: "1px solid rgba(90,196,255,0.2)",
                color: "#5ac4ff",
              }}
            >
              <Edit2 className="size-3.5" />
              Edit Tenant
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 text-xs">
            {/* Basic info */}
            <div
              className="rounded-xl p-3 space-y-1.5"
              style={{ background: "rgba(255,255,255,0.03)" }}
            >
              <p className="font-medium text-[var(--foreground)] mb-2">Info</p>
              <p className="flex justify-between">
                <span className="text-[var(--muted-foreground)]">ID</span>
                <span className="font-mono text-[var(--foreground)]">{tenantId(tenant)}</span>
              </p>
              {tenant.billingEmail && (
                <p className="flex justify-between gap-2">
                  <span className="text-[var(--muted-foreground)]">Billing</span>
                  <span className="text-[var(--foreground)] truncate">{tenant.billingEmail}</span>
                </p>
              )}
              <p className="flex justify-between">
                <span className="text-[var(--muted-foreground)]">Created</span>
                <span className="text-[var(--foreground)]">{fmtDate(tenant.createdAt)}</span>
              </p>
            </div>

            {/* Config */}
            {tenant.config && Object.keys(tenant.config).length > 0 && (
              <div
                className="rounded-xl p-3"
                style={{ background: "rgba(255,255,255,0.03)" }}
              >
                <p className="font-medium text-[var(--foreground)] mb-2">Config</p>
                <pre className="text-[var(--muted-foreground)] overflow-auto max-h-24 text-xs">
                  {JSON.stringify(tenant.config, null, 2)}
                </pre>
              </div>
            )}

            {/* Isolation */}
            {tenant.isolation && Object.keys(tenant.isolation).length > 0 && (
              <div
                className="rounded-xl p-3"
                style={{ background: "rgba(255,255,255,0.03)" }}
              >
                <p className="font-medium text-[var(--foreground)] mb-2">Isolation</p>
                <pre className="text-[var(--muted-foreground)] overflow-auto max-h-24 text-xs">
                  {JSON.stringify(tenant.isolation, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function TenantsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);
  const [isPending, startTransition] = useTransition();

  const fetchTenants = useCallback(async () => {
    try {
      const res = await fetch("/api/tenants");
      const json = await res.json().catch(() => ({}));
      const list: Tenant[] = Array.isArray(json?.items)
        ? json.items
        : Array.isArray(json)
        ? json
        : [];
      setTenants(list);
      setError(null);
    } catch {
      setError("Failed to load tenants");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTenants();
  }, [fetchTenants]);

  const handleCreate = (data: TenantFormData) => {
    startTransition(async () => {
      try {
        await fetch("/api/tenants", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            name: data.name,
            domain: data.domain,
            plan: data.plan,
            maxUsers: parseInt(data.maxUsers, 10),
            billingEmail: data.billingEmail,
          }),
        });
        setShowCreate(false);
        await fetchTenants();
      } catch {
        /* ignore */
      }
    });
  };

  const handleEdit = (data: TenantFormData) => {
    if (!editingTenant) return;
    startTransition(async () => {
      try {
        await fetch("/api/tenants", {
          method: "POST", // backend uses POST/upsert
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            tenantId: tenantId(editingTenant),
            name: data.name,
            domain: data.domain,
            plan: data.plan,
            maxUsers: parseInt(data.maxUsers, 10),
            billingEmail: data.billingEmail,
          }),
        });
        setEditingTenant(null);
        await fetchTenants();
      } catch {
        /* ignore */
      }
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="size-6 animate-spin" style={{ color: "var(--accent)" }} />
      </div>
    );
  }

  const editFormInitial: TenantFormData = editingTenant
    ? {
        name: editingTenant.name ?? "",
        domain: (editingTenant.domain as string) ?? "",
        plan: (editingTenant.plan as TenantPlan) ?? "starter",
        maxUsers: String(editingTenant.maxUsers ?? 10),
        billingEmail: (editingTenant.billingEmail as string) ?? "",
      }
    : DEFAULT_FORM;

  return (
    <div className="space-y-5 p-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)] flex items-center gap-2">
            <Building2 className="size-6" style={{ color: "var(--accent)" }} />
            Tenant Management
          </h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">
            Manage organizations, plans and configurations
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchTenants}
            className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs transition-opacity hover:opacity-70"
            style={{
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "var(--muted-foreground)",
            }}
          >
            <RefreshCw className="size-3.5" />
            Refresh
          </button>
          <button
            onClick={() => {
              setShowCreate(true);
              setEditingTenant(null);
            }}
            className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-medium"
            style={{
              background: "rgba(90,196,255,0.15)",
              border: "1px solid rgba(90,196,255,0.3)",
              color: "var(--accent)",
            }}
          >
            <Plus className="size-3.5" />
            New Tenant
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          {
            label: "Total",
            value: tenants.length,
            color: "#5ac4ff",
          },
          {
            label: "Active",
            value: tenants.filter((t) => t.status === "active").length,
            color: "#22c55e",
          },
          {
            label: "Enterprise",
            value: tenants.filter((t) => t.plan === "enterprise").length,
            color: "#a855f7",
          },
          {
            label: "Suspended",
            value: tenants.filter((t) => t.status === "suspended").length,
            color: "#f87171",
          },
        ].map((c) => (
          <div
            key={c.label}
            className="glass-card p-4 text-center"
            style={{ border: `1px solid ${c.color}22` }}
          >
            <p className="text-2xl font-bold" style={{ color: c.color }}>
              {c.value}
            </p>
            <p className="text-xs text-[var(--muted-foreground)] mt-0.5">{c.label}</p>
          </div>
        ))}
      </div>

      {error && (
        <div
          className="glass-card p-4 flex items-center gap-2 text-sm"
          style={{ borderLeft: "3px solid #f87171", color: "#f87171" }}
        >
          <AlertCircle className="size-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Create Form */}
      {showCreate && (
        <TenantForm
          initial={DEFAULT_FORM}
          onSubmit={handleCreate}
          onClose={() => setShowCreate(false)}
          submitting={isPending}
          title="Create New Tenant"
        />
      )}

      {/* Edit Form */}
      {editingTenant && (
        <TenantForm
          initial={editFormInitial}
          onSubmit={handleEdit}
          onClose={() => setEditingTenant(null)}
          submitting={isPending}
          title={`Edit: ${editingTenant.name}`}
        />
      )}

      {/* Tenant List */}
      <div className="glass-card overflow-hidden">
        <div
          className="px-5 py-3 border-b"
          style={{ borderColor: "rgba(255,255,255,0.06)" }}
        >
          <span className="text-sm font-semibold text-[var(--foreground)]">
            Tenants ({tenants.length})
          </span>
        </div>

        {tenants.length === 0 ? (
          <div className="p-10 text-center">
            <Building2
              className="size-10 mx-auto mb-3"
              style={{ color: "var(--accent)", opacity: 0.3 }}
            />
            <p className="text-sm text-[var(--muted-foreground)]">
              No tenants found. Create the first one.
            </p>
          </div>
        ) : (
          <div className="p-4 space-y-2">
            {tenants.map((t) => (
              <TenantRow
                key={tenantId(t)}
                tenant={t}
                onEdit={(tenant) => {
                  setEditingTenant(tenant);
                  setShowCreate(false);
                  // Scroll to top of form
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
