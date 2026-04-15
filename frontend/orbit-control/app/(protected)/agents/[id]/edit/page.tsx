"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { Bot, ChevronLeft, Check } from "lucide-react";

const CATEGORIES = ["Marketing", "Sales", "IT", "Finance", "Operations", "Admin"];
const DOMAINS    = ["marketing", "executive", "retail", "it", "research"];
const TOOLS      = ["web_search", "memory_search", "memory_save", "webhook_trigger", "desktop_observe", "get_system_status"];
const STATUSES   = ["active", "paused", "idle", "error"] as const;
const VISIBILITY = ["public", "tenant", "private"] as const;

interface AgentForm {
  name:         string;
  category:     string;
  subCategory:  string;
  owner:        string;
  domain:       string;
  description:  string;
  systemPrompt: string;
  status:       string;
  tags:         string;
  tools:        string[];
  visibleTo:    string[];
}

const DOMAIN_MAP: Record<string, string> = {
  Marketing: "marketing", Sales: "executive", IT: "it",
  Finance: "executive", Operations: "retail", Admin: "executive",
};

export default function AgentEditPage() {
  const params   = useParams<{ id: string }>();
  const router   = useRouter();
  const agentId  = params.id;

  const [loading,    setLoading]    = useState(true);
  const [notFound,   setNotFound]   = useState(false);
  const [error,      setError]      = useState("");
  const [success,    setSuccess]    = useState(false);
  const [pending,    startTransition] = useTransition();

  const [form, setForm] = useState<AgentForm>({
    name: "", category: "Marketing", subCategory: "", owner: "",
    domain: "marketing", description: "", systemPrompt: "",
    status: "active", tags: "", tools: [], visibleTo: [],
  });

  // Load agent data
  useEffect(() => {
    fetch(`/api/agents/${agentId}`)
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(agent => {
        setForm({
          name:         agent.name         ?? "",
          category:     agent.category     ?? "Marketing",
          subCategory:  agent.subCategory  ?? "",
          owner:        agent.owner        ?? "",
          domain:       agent.domain       ?? "marketing",
          description:  agent.description  ?? "",
          systemPrompt: agent.systemPrompt ?? "",
          status:       agent.status       ?? "active",
          tags:         Array.isArray(agent.tags) ? agent.tags.join(", ") : "",
          tools:        Array.isArray(agent.tools)     ? agent.tools     : [],
          visibleTo:    Array.isArray(agent.visibleTo) ? agent.visibleTo : [],
        });
        setLoading(false);
      })
      .catch(code => {
        if (code === 404) setNotFound(true);
        setLoading(false);
      });
  }, [agentId]);

  function set(key: keyof AgentForm, value: unknown) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  function toggleTool(tool: string) {
    set("tools", form.tools.includes(tool)
      ? form.tools.filter(t => t !== tool)
      : [...form.tools, tool]);
  }

  function toggleVisible(cat: string) {
    set("visibleTo", form.visibleTo.includes(cat)
      ? form.visibleTo.filter(c => c !== cat)
      : [...form.visibleTo, cat]);
  }

  function handleCategoryChange(cat: string) {
    set("category", cat);
    set("domain", DOMAIN_MAP[cat] ?? "executive");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { setError("Name ist Pflichtfeld."); return; }
    setError("");
    setSuccess(false);

    startTransition(async () => {
      const res = await fetch(`/api/agents/${agentId}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...form,
          tags: form.tags.split(",").map(t => t.trim()).filter(Boolean),
        }),
      });

      if (res.ok) {
        setSuccess(true);
        setTimeout(() => {
          router.push(`/agents/${agentId}`);
          router.refresh();
        }, 1200);
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Fehler beim Speichern. Ist das Backend erreichbar?");
      }
    });
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <div className="h-8 w-32 animate-pulse rounded-[12px] bg-white/5" />
        <div className="h-96 animate-pulse rounded-[32px] bg-white/5" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <Link href="/agents" className="inline-flex items-center gap-2 text-sm text-[var(--muted-foreground)] transition hover:text-white">
          <ChevronLeft className="size-4" /> Alle Agents
        </Link>
        <section className="rounded-[32px] border border-white/10 bg-black/20 p-8 text-center backdrop-blur">
          <p className="text-sm text-red-400">Agent nicht gefunden.</p>
          <Link href="/agents" className="mt-4 inline-block text-sm text-[var(--accent)] hover:underline">
            Zur Übersicht
          </Link>
        </section>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      {/* Back */}
      <Link
        href={`/agents/${agentId}`}
        className="inline-flex items-center gap-2 text-sm text-[var(--muted-foreground)] transition hover:text-white"
      >
        <ChevronLeft className="size-4" /> Agent Details
      </Link>

      <section className="rounded-[32px] border border-white/10 bg-black/20 p-6 backdrop-blur">
        <div className="mb-6 flex items-center gap-3">
          <div className="rounded-[18px] bg-[rgba(90,196,255,0.10)] p-3">
            <Bot className="size-6 text-[var(--accent)]" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Agent bearbeiten</h2>
            <p className="text-xs text-[var(--muted-foreground)]">Konfiguration, Status und Tools anpassen</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">

          {/* Name */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[var(--muted-foreground)]">Name *</label>
            <input
              value={form.name}
              onChange={e => set("name", e.target.value)}
              placeholder="z.B. Email Kampagnen Agent"
              className="w-full rounded-[18px] border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white outline-none placeholder:text-[var(--muted-foreground)] focus:border-[rgba(90,196,255,0.4)]"
            />
          </div>

          {/* Kategorie + Status */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[var(--muted-foreground)]">Kategorie</label>
              <select
                value={form.category}
                onChange={e => handleCategoryChange(e.target.value)}
                className="w-full rounded-[18px] border border-white/10 bg-black/40 px-4 py-2.5 text-sm text-white outline-none"
              >
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[var(--muted-foreground)]">Status</label>
              <select
                value={form.status}
                onChange={e => set("status", e.target.value)}
                className="w-full rounded-[18px] border border-white/10 bg-black/40 px-4 py-2.5 text-sm text-white outline-none"
              >
                {STATUSES.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>

          {/* Sub-Kategorie + Owner */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[var(--muted-foreground)]">Sub-Kategorie</label>
              <input
                value={form.subCategory}
                onChange={e => set("subCategory", e.target.value)}
                placeholder="z.B. Campaigns, Pipeline..."
                className="w-full rounded-[18px] border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white outline-none placeholder:text-[var(--muted-foreground)]"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[var(--muted-foreground)]">Owner (Email)</label>
              <input
                value={form.owner}
                onChange={e => set("owner", e.target.value)}
                placeholder="anna@company.com"
                className="w-full rounded-[18px] border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white outline-none placeholder:text-[var(--muted-foreground)]"
              />
            </div>
          </div>

          {/* Domain + Visibility */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[var(--muted-foreground)]">Domain</label>
              <select
                value={form.domain}
                onChange={e => set("domain", e.target.value)}
                className="w-full rounded-[18px] border border-white/10 bg-black/40 px-4 py-2.5 text-sm text-white outline-none"
              >
                {DOMAINS.map(d => <option key={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[var(--muted-foreground)]">Sichtbarkeit</label>
              <select
                value={form.visibleTo.includes("public") ? "public" : form.visibleTo.includes("private") ? "private" : "tenant"}
                onChange={e => {
                  const v = e.target.value;
                  if (v === "public")  set("visibleTo", ["public"]);
                  if (v === "private") set("visibleTo", ["private"]);
                  if (v === "tenant")  set("visibleTo", [form.category, "Admin"]);
                }}
                className="w-full rounded-[18px] border border-white/10 bg-black/40 px-4 py-2.5 text-sm text-white outline-none"
              >
                {VISIBILITY.map(v => <option key={v}>{v}</option>)}
              </select>
            </div>
          </div>

          {/* Beschreibung */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[var(--muted-foreground)]">Beschreibung</label>
            <textarea
              value={form.description}
              onChange={e => set("description", e.target.value)}
              rows={2}
              placeholder="Was macht dieser Agent?"
              className="w-full resize-none rounded-[18px] border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white outline-none placeholder:text-[var(--muted-foreground)]"
            />
          </div>

          {/* System Prompt */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[var(--muted-foreground)]">System Prompt</label>
            <textarea
              value={form.systemPrompt}
              onChange={e => set("systemPrompt", e.target.value)}
              rows={3}
              placeholder="Du bist ein spezialisierter Agent für..."
              className="w-full resize-none rounded-[18px] border border-white/10 bg-white/5 px-4 py-2.5 font-mono text-xs text-white outline-none placeholder:text-[var(--muted-foreground)]"
            />
          </div>

          {/* Tags */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[var(--muted-foreground)]">Tags (kommagetrennt)</label>
            <input
              value={form.tags}
              onChange={e => set("tags", e.target.value)}
              placeholder="email, automation, newsletter"
              className="w-full rounded-[18px] border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white outline-none placeholder:text-[var(--muted-foreground)]"
            />
          </div>

          {/* Tools */}
          <div>
            <label className="mb-2 block text-xs font-medium text-[var(--muted-foreground)]">Tools</label>
            <div className="flex flex-wrap gap-2">
              {TOOLS.map(tool => (
                <button
                  key={tool}
                  type="button"
                  onClick={() => toggleTool(tool)}
                  className="rounded-full border px-3 py-1 text-xs transition"
                  style={{
                    background:  form.tools.includes(tool) ? "rgba(90,196,255,0.10)" : "rgba(255,255,255,0.04)",
                    borderColor: form.tools.includes(tool) ? "rgba(90,196,255,0.35)" : "rgba(255,255,255,0.10)",
                    color:       form.tools.includes(tool) ? "var(--accent)" : "var(--muted-foreground)",
                  }}
                >
                  {tool}
                </button>
              ))}
            </div>
          </div>

          {/* Sichtbar für */}
          <div>
            <label className="mb-2 block text-xs font-medium text-[var(--muted-foreground)]">Sichtbar für Rollen</label>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map(cat => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => toggleVisible(cat)}
                  className="rounded-full border px-3 py-1 text-xs transition"
                  style={{
                    background:  form.visibleTo.includes(cat) ? "rgba(34,197,94,0.10)" : "rgba(255,255,255,0.04)",
                    borderColor: form.visibleTo.includes(cat) ? "rgba(34,197,94,0.35)" : "rgba(255,255,255,0.10)",
                    color:       form.visibleTo.includes(cat) ? "#22c55e" : "var(--muted-foreground)",
                  }}
                >
                  {cat}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-[11px] text-[var(--muted-foreground)]">Admin sieht immer alle Agents.</p>
          </div>

          {/* Error / Success */}
          {error   && <p className="text-sm text-red-400">{error}</p>}
          {success && (
            <div className="flex items-center gap-2 rounded-[14px] border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-sm text-emerald-300">
              <Check className="size-4" />
              Gespeichert. Weiterleitung…
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="submit"
              disabled={pending || success}
              className="flex-1 rounded-[20px] border border-[rgba(90,196,255,0.3)] bg-[rgba(90,196,255,0.10)] py-3 text-sm font-semibold text-[var(--accent)] transition hover:bg-[rgba(90,196,255,0.18)] disabled:opacity-50"
            >
              {pending ? "Wird gespeichert…" : "Änderungen speichern"}
            </button>
            <Link
              href={`/agents/${agentId}`}
              className="flex-1 rounded-[20px] border border-white/10 bg-white/5 py-3 text-center text-sm font-medium text-[var(--muted-foreground)] transition hover:bg-white/8 hover:text-white"
            >
              Abbrechen
            </Link>
          </div>
        </form>
      </section>
    </div>
  );
}
