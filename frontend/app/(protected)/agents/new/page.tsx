"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Bot, ChevronLeft } from "lucide-react";
import Link from "next/link";
import { AgentLimitBanner } from "@/components/agents/agent-limit-banner";

const COMMUNITY_LIMIT = 3;

const CATEGORIES = ["Marketing", "Sales", "IT", "Finance", "Operations", "Admin"];
const DOMAINS    = ["marketing", "executive", "retail", "it", "research"];
const TOOLS      = ["web_search", "memory_search", "memory_save", "webhook_trigger", "desktop_observe", "get_system_status"];

export default function NewAgentPage() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [agentCount, setAgentCount] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/agents/stats")
      .then(r => r.json())
      .then(d => setAgentCount(d?.total ?? null))
      .catch(() => {});
  }, []);

  const [form, setForm] = useState({
    name:         "",
    category:     "Marketing",
    subCategory:  "",
    owner:        "",
    domain:       "marketing",
    description:  "",
    systemPrompt: "",
    tags:         "",
    tools:        ["web_search", "memory_search"] as string[],
    visibleTo:    ["Marketing", "Admin"] as string[],
  });

  function set(key: string, value: unknown) {
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
    const domainMap: Record<string, string> = {
      Marketing: "marketing", Sales: "executive", IT: "it",
      Finance: "executive", Operations: "retail", Admin: "executive",
    };
    set("category", cat);
    set("domain", domainMap[cat] ?? "executive");
    if (!form.visibleTo.includes(cat)) {
      set("visibleTo", [...form.visibleTo.filter(c => c !== form.category), cat]);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { setError("Name ist Pflichtfeld."); return; }
    setError("");
    startTransition(async () => {
      const res = await fetch("/api/agents", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...form,
          tags: form.tags.split(",").map(t => t.trim()).filter(Boolean),
        }),
      });
      if (res.ok) {
        router.push("/agents");
        router.refresh();
      } else if (res.status === 403) {
        const data = await res.json().catch(() => ({}));
        if (data.code === "COMMUNITY_LIMIT_EXCEEDED") {
          setError(`Community Edition: Maximale Anzahl von ${data.limit ?? 3} Agents erreicht. Für unbegrenzte Agents bitte auf Enterprise upgraden.`);
        } else {
          setError("Keine Berechtigung zum Anlegen dieses Agents.");
        }
      } else {
        setError("Fehler beim Anlegen. Ist das Backend erreichbar?");
      }
    });
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      {/* Back */}
      <Link href="/agents" className="inline-flex items-center gap-2 text-sm text-[var(--muted-foreground)] transition hover:text-white">
        <ChevronLeft className="size-4" /> Zurück zu Agents
      </Link>

      {/* Community-Limit Banner (zeigt aktuellen Stand) */}
      {agentCount !== null && (
        <AgentLimitBanner current={agentCount} limit={COMMUNITY_LIMIT} />
      )}

      <section className="rounded-[32px] border border-white/10 bg-black/20 p-6 backdrop-blur">
        <div className="mb-6 flex items-center gap-3">
          <div className="rounded-[18px] bg-[rgba(90,196,255,0.10)] p-3">
            <Bot className="size-6 text-[var(--accent)]" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Neuer Agent</h2>
            <p className="text-xs text-[var(--muted-foreground)]">Kategorie, Rollen-Sichtbarkeit und Tools konfigurieren</p>
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

          {/* Kategorie + Sub */}
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
              <label className="mb-1.5 block text-xs font-medium text-[var(--muted-foreground)]">Sub-Kategorie</label>
              <input
                value={form.subCategory}
                onChange={e => set("subCategory", e.target.value)}
                placeholder="z.B. Campaigns, Pipeline..."
                className="w-full rounded-[18px] border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white outline-none placeholder:text-[var(--muted-foreground)]"
              />
            </div>
          </div>

          {/* Owner + Domain */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[var(--muted-foreground)]">Owner (Email)</label>
              <input
                value={form.owner}
                onChange={e => set("owner", e.target.value)}
                placeholder="anna@company.com"
                className="w-full rounded-[18px] border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white outline-none placeholder:text-[var(--muted-foreground)]"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[var(--muted-foreground)]">Domain Agent</label>
              <select
                value={form.domain}
                onChange={e => set("domain", e.target.value)}
                className="w-full rounded-[18px] border border-white/10 bg-black/40 px-4 py-2.5 text-sm text-white outline-none"
              >
                {DOMAINS.map(d => <option key={d}>{d}</option>)}
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
              className="w-full rounded-[18px] border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white outline-none placeholder:text-[var(--muted-foreground)] resize-none"
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
              className="w-full rounded-[18px] border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white outline-none placeholder:text-[var(--muted-foreground)] resize-none font-mono text-xs"
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
                    background:   form.tools.includes(tool) ? "rgba(90,196,255,0.10)" : "rgba(255,255,255,0.04)",
                    borderColor:  form.tools.includes(tool) ? "rgba(90,196,255,0.35)" : "rgba(255,255,255,0.10)",
                    color:        form.tools.includes(tool) ? "var(--accent)" : "var(--muted-foreground)",
                  }}
                >
                  {tool}
                </button>
              ))}
            </div>
          </div>

          {/* Sichtbar für */}
          <div>
            <label className="mb-2 block text-xs font-medium text-[var(--muted-foreground)]">Sichtbar für</label>
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

          {error && <p className="text-sm text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-[20px] border border-[rgba(90,196,255,0.3)] bg-[rgba(90,196,255,0.10)] py-3 text-sm font-semibold text-[var(--accent)] transition hover:bg-[rgba(90,196,255,0.18)] disabled:opacity-50"
          >
            {pending ? "Wird angelegt…" : "Agent anlegen"}
          </button>
        </form>
      </section>
    </div>
  );
}
