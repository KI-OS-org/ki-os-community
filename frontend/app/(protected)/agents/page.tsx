import Link from "next/link";
import { Plus, Bot } from "lucide-react";
import { orbitFetch } from "@/lib/core/orbit-fetch";
import { Badge } from "@/components/ui/badge";
import { AgentList } from "@/components/agents/agent-list";
import { AgentHeatmap } from "@/components/agents/agent-heatmap";
import { AgentLimitBanner } from "@/components/agents/agent-limit-banner";

const COMMUNITY_LIMIT = 3;

export default async function AgentsPage() {
  const [statsRes, agentsRes] = await Promise.allSettled([
    orbitFetch("/agents/stats"),
    orbitFetch("/agents"),
  ]);

  const stats = statsRes.status === "fulfilled" ? statsRes.value.data : null;
  const agentsData = agentsRes.status === "fulfilled" ? agentsRes.value.data : null;
  const agents: unknown[] = Array.isArray((agentsData as { agents?: unknown[] })?.agents)
    ? (agentsData as { agents: unknown[] }).agents
    : [];
  const agentCount: number = (stats as { total?: number } | null)?.total ?? agents.length;
  const atLimit = agentCount >= COMMUNITY_LIMIT;

  return (
    <>
      {/* Header */}
      <section className="rounded-[32px] border border-white/10 bg-black/20 p-5 backdrop-blur md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <Badge>Agent Registry</Badge>
              <Badge className="text-cyan-200">Kategorien</Badge>
              <Badge className="text-emerald-200">Live Status</Badge>
            </div>
            <h2 className="mt-3 text-xl font-semibold tracking-tight">Agent Management</h2>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">
              Alle Agents verwalten — nach Kategorie, Status und Rolle filtern.
            </p>
          </div>
          {atLimit ? (
            <span
              title={`Community Edition: max ${COMMUNITY_LIMIT} Agents erreicht`}
              className="inline-flex items-center gap-2 rounded-[20px] border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-gray-500 cursor-not-allowed opacity-60"
            >
              <Plus className="size-4" />
              Neuer Agent
            </span>
          ) : (
            <Link
              href="/agents/new"
              className="inline-flex items-center gap-2 rounded-[20px] border border-[rgba(90,196,255,0.3)] bg-[rgba(90,196,255,0.08)] px-4 py-2.5 text-sm font-medium text-[var(--accent)] transition hover:bg-[rgba(90,196,255,0.15)]"
            >
              <Plus className="size-4" />
              Neuer Agent
            </Link>
          )}
        </div>
      </section>

      {/* Community Edition Limit-Banner */}
      <AgentLimitBanner current={agentCount} limit={COMMUNITY_LIMIT} />

      {/* Heatmap */}
      <AgentHeatmap stats={stats} />

      {/* Agent List */}
      <AgentList agents={agents} />
    </>
  );
}
