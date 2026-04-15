import { ArrowRight } from "lucide-react";
import Link from "next/link";

interface Domain {
  id: string;
  label: string;
  description: string;
  href: string;
  status: string;
  icon: string;
}

interface Props {
  domains?: Domain[];
}

function statusBadgeClass(status: string): string {
  if (status === "active") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-400";
  if (status === "beta") return "border-[var(--accent)]/30 bg-[rgba(90,196,255,0.1)] text-[var(--accent)]";
  if (status === "coming soon") return "border-white/10 bg-white/5 text-[var(--muted-foreground)]";
  return "border-white/10 bg-white/5 text-[var(--muted-foreground)]";
}

function statusDotClass(status: string): string {
  if (status === "active") return "status-dot green";
  if (status === "beta") return "status-dot blue";
  return "status-dot yellow";
}

export function DomainEntryGrid({ domains }: Props) {
  if (!domains || domains.length === 0) return null;

  return (
    <div
      data-testid="domain-entry-grid"
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
        gap: "1rem",
      }}
    >
      {domains.map((domain) => (
        <Link
          key={domain.id}
          href={domain.href}
          className="glass-card group flex flex-col overflow-hidden no-underline"
        >
          {/* Gradient top bar */}
          <div className="h-1 w-full bg-gradient-to-r from-[var(--accent)] to-teal-400 opacity-50 group-hover:opacity-100 transition-opacity" />

          <div className="flex flex-col gap-3 p-5">
            {/* Icon circle */}
            <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[rgba(90,196,255,0.2)] bg-[rgba(90,196,255,0.08)] text-xl">
              {domain.icon}
            </div>

            {/* Title + status */}
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-base font-bold text-white group-hover:text-[var(--accent)] transition-colors">
                {domain.label}
              </h3>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className={statusDotClass(domain.status)} />
                <span
                  className={`rounded-full border px-2 py-0.5 text-[10px] font-medium capitalize ${statusBadgeClass(domain.status)}`}
                >
                  {domain.status}
                </span>
              </div>
            </div>

            {/* Description */}
            <p className="text-xs text-[var(--muted-foreground)] leading-relaxed flex-1">
              {domain.description}
            </p>

            {/* Arrow link */}
            <div className="flex items-center gap-1 text-xs text-[var(--accent)] opacity-0 group-hover:opacity-100 transition-opacity">
              Open <ArrowRight className="h-3 w-3" />
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
