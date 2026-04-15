import { CheckCircle2, Activity, Database, Radar } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { MissionControlStatus } from "@/lib/adapters/mission-control";

export function SystemStatusWidget({ status }: { status: MissionControlStatus }) {
  const trustLabel = status.trust === "stable" ? "stabil" : status.trust === "review" ? "prüfen" : "Aufmerksamkeit";

  return (
    <Card>
      <CardHeader>
        <Badge>Systemstatus</Badge>
        <CardTitle className="text-xl">Alles Wichtige auf einen Blick</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2">
        <StatusLine icon={CheckCircle2} label="Vertrauen" value={trustLabel} />
        <StatusLine icon={Activity} label="Aktive Läufe" value={String(status.activeFlows)} />
        <StatusLine icon={Database} label="Gedächtnis" value={status.memoryReady ? "bereit" : "begrenzt"} />
        <StatusLine icon={Radar} label="Transparenz" value={status.traces} />
      </CardContent>
    </Card>
  );
}

function StatusLine({ icon: Icon, label, value }: { icon: typeof CheckCircle2; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-[22px] border border-white/8 bg-white/3 p-4 text-sm">
      <div className="rounded-full border border-cyan-400/20 bg-cyan-400/10 p-2 text-cyan-200">
        <Icon className="size-4" />
      </div>
      <div>
        <div className="text-[var(--muted-foreground)]">{label}</div>
        <div className="font-medium text-[var(--foreground)]">{value}</div>
      </div>
    </div>
  );
}
