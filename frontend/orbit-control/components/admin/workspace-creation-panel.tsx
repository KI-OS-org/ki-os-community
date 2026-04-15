"use client";

import { useState } from "react";
import { CheckCircle, Loader2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const TENANTS = ["demo-tenant", "ops-tenant", "audit-tenant", "retail-tenant"];

type FormState = "idle" | "submitting" | "success" | "error";

export function WorkspaceCreationPanel() {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [tenant, setTenant] = useState(TENANTS[0]);
  const [formState, setFormState] = useState<FormState>("idle");
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    setFormState("submitting");
    setErrorMessage("");

    try {
      const res = await fetch("/api/tenants/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), description: description.trim(), tenant }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.message ?? `HTTP ${res.status}`);
      }

      setFormState("success");
      setName("");
      setDescription("");
      setTenant(TENANTS[0]);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Unbekannter Fehler");
      setFormState("error");
    }
  }

  const inputClass =
    "w-full rounded-[14px] border border-white/10 bg-white/5 px-3 py-2.5 text-sm outline-none placeholder:text-[var(--muted-foreground)] focus:border-[rgba(90,196,255,0.4)] focus:bg-[rgba(90,196,255,0.04)] transition";

  return (
    <div className="rounded-[32px] border border-white/10 bg-black/20 p-5 backdrop-blur">
      <h2 className="text-xl font-semibold">Workspace erstellen</h2>
      <p className="mt-1 text-sm text-[var(--muted-foreground)]">
        Neuen Workspace für einen Tenant anlegen.
      </p>

      <form onSubmit={handleSubmit} className="mt-5 space-y-4">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-[var(--muted-foreground)]">
            Name *
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="z.B. marketing-workspace"
            required
            className={inputClass}
          />
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-[var(--muted-foreground)]">
            Beschreibung
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optionale Beschreibung…"
            rows={3}
            className={cn(inputClass, "resize-none")}
          />
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-[var(--muted-foreground)]">
            Tenant
          </label>
          <select
            value={tenant}
            onChange={(e) => setTenant(e.target.value)}
            className={cn(inputClass, "cursor-pointer")}
          >
            {TENANTS.map((t) => (
              <option key={t} value={t} className="bg-[#08101f]">
                {t}
              </option>
            ))}
          </select>
        </div>

        {/* Feedback */}
        {formState === "success" && (
          <div className="flex items-center gap-2 rounded-[14px] border border-emerald-500/20 bg-emerald-500/10 px-3 py-2.5 text-sm text-emerald-300">
            <CheckCircle className="size-4 shrink-0" />
            Workspace erfolgreich erstellt.
          </div>
        )}
        {formState === "error" && (
          <div className="flex items-center gap-2 rounded-[14px] border border-red-500/20 bg-red-500/10 px-3 py-2.5 text-sm text-red-300">
            <XCircle className="size-4 shrink-0" />
            Fehler: {errorMessage}
          </div>
        )}

        <button
          type="submit"
          disabled={formState === "submitting" || !name.trim()}
          className="inline-flex w-full items-center justify-center gap-2 rounded-[14px] border border-[rgba(90,196,255,0.3)] bg-[rgba(90,196,255,0.1)] px-4 py-2.5 text-sm font-medium text-[var(--accent)] transition hover:bg-[rgba(90,196,255,0.18)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {formState === "submitting" ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Erstellen…
            </>
          ) : (
            "Workspace erstellen"
          )}
        </button>
      </form>
    </div>
  );
}
