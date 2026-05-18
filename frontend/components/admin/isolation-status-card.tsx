import { ShieldCheck, ShieldAlert, ShieldOff } from "lucide-react";
import { cn } from "@/lib/utils";

interface IsolationStatusCardProps {
  tenantId?: string;
  status?: string;
  level?: string;
}

function resolveIcon(status?: string) {
  if (!status || status === "active" || status === "enforced" || status === "ok") {
    return ShieldCheck;
  }
  if (status === "degraded" || status === "partial") {
    return ShieldAlert;
  }
  return ShieldOff;
}

function resolveColors(status?: string): { dot: string; icon: string; badge: string } {
  if (!status || status === "active" || status === "enforced" || status === "ok") {
    return {
      dot: "bg-emerald-400",
      icon: "text-emerald-400",
      badge: "border-emerald-500/20 bg-emerald-500/10 text-emerald-300",
    };
  }
  if (status === "degraded" || status === "partial") {
    return {
      dot: "bg-yellow-400",
      icon: "text-yellow-400",
      badge: "border-yellow-500/20 bg-yellow-500/10 text-yellow-300",
    };
  }
  return {
    dot: "bg-red-400",
    icon: "text-red-400",
    badge: "border-red-500/20 bg-red-500/10 text-red-300",
  };
}

const levelLabels: Record<string, string> = {
  strict: "Strict",
  standard: "Standard",
  relaxed: "Relaxed",
  none: "None",
};

export function IsolationStatusCard({
  tenantId = "demo-tenant",
  status = "active",
  level = "strict",
}: IsolationStatusCardProps) {
  const Icon = resolveIcon(status);
  const colors = resolveColors(status);
  const displayLevel = levelLabels[level] ?? level;
  const displayStatus = status.charAt(0).toUpperCase() + status.slice(1);

  return (
    <div className="glass-card rounded-[24px] border border-white/10 bg-black/20 p-5 backdrop-blur">
      <div className="flex items-start gap-4">
        <div
          className={cn(
            "flex size-12 shrink-0 items-center justify-center rounded-2xl border",
            status === "active" || status === "enforced" || status === "ok"
              ? "border-emerald-500/20 bg-emerald-500/10"
              : status === "degraded" || status === "partial"
                ? "border-yellow-500/20 bg-yellow-500/10"
                : "border-red-500/20 bg-red-500/10",
          )}
        >
          <Icon className={cn("size-6", colors.icon)} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold">Tenant Isolation</h3>
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs",
                colors.badge,
              )}
            >
              <span className={cn("inline-block size-1.5 rounded-full", colors.dot)} />
              {displayStatus}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">
            Tenant: <span className="font-mono">{tenantId}</span>
          </p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-[14px] border border-white/8 bg-white/4 px-3 py-2.5">
          <p className="text-[10px] uppercase tracking-widest text-[var(--muted-foreground)]">
            Level
          </p>
          <p className="mt-1 text-sm font-medium text-white">{displayLevel}</p>
        </div>
        <div className="rounded-[14px] border border-white/8 bg-white/4 px-3 py-2.5">
          <p className="text-[10px] uppercase tracking-widest text-[var(--muted-foreground)]">
            Status
          </p>
          <p className={cn("mt-1 text-sm font-medium", colors.icon)}>{displayStatus}</p>
        </div>
      </div>

      <div className="mt-3 rounded-[14px] border border-white/8 bg-white/4 px-3 py-2.5 text-xs text-[var(--muted-foreground)]">
        {level === "strict"
          ? "Vollständige Datenisolierung. Kein Cross-Tenant-Datenzugriff erlaubt."
          : level === "standard"
            ? "Standard-Isolation. Gemeinsame Ressourcen sind beschränkt."
            : level === "relaxed"
              ? "Minimale Isolation. Für Entwicklungsumgebungen."
              : "Keine Isolation konfiguriert."}
      </div>
    </div>
  );
}
