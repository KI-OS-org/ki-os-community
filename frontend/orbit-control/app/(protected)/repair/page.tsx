import Link from "next/link";
import { ShieldAlert, Wrench } from "lucide-react";
import { orbitFetch } from "@/lib/core/orbit-fetch";
import { RepairStats }     from "@/components/repair/repair-stats";
import { IncidentList }    from "@/components/repair/incident-list";

export const dynamic = "force-dynamic";

interface Stats {
  total: number; open: number;
  l1_open: number; l2_open: number; l3_open: number;
  fix_ready: number; resolved: number;
}

export default async function RepairPage() {
  const [statsRes, incidentsRes] = await Promise.all([
    orbitFetch<Stats>("/selfrepair/stats"),
    orbitFetch<{ incidents: unknown[]; total: number }>("/selfrepair"),
  ]);

  const stats     = statsRes.data   ?? { total: 0, open: 0, l1_open: 0, l2_open: 0, l3_open: 0, fix_ready: 0, resolved: 0 };
  const incidents = incidentsRes.data?.incidents ?? [];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-[16px] bg-[rgba(239,68,68,0.10)]">
            <Wrench className="size-5 text-red-400" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-white">SelfRepair</h1>
            <p className="text-xs text-[var(--muted-foreground)]">Automatische Fehlererkennung, Klassifizierung & AI-gestützte Reparatur</p>
          </div>
        </div>
        {stats.l1_open > 0 && (
          <div className="flex items-center gap-2 rounded-[16px] border border-red-500/30 bg-red-500/10 px-3 py-1.5">
            <ShieldAlert className="size-4 text-red-400" />
            <span className="text-sm font-medium text-red-300">{stats.l1_open} kritische{stats.l1_open !== 1 ? "" : "r"} Incident{stats.l1_open !== 1 ? "s" : ""}</span>
          </div>
        )}
      </div>

      {/* Stats */}
      <RepairStats stats={stats} />

      {/* Incident List */}
      <IncidentList incidents={incidents} />
    </div>
  );
}
