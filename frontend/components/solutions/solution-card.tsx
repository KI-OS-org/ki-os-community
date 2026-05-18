import Link from "next/link";
import { ArrowRight } from "lucide-react";

export type SolutionCardProps = {
  id: string;
  title: string;
  domain: string;
  role: string;
  status: "ready" | "pilot" | "beta";
  description?: string;
  href?: string;
};

const statusStyle: Record<string, string> = {
  ready:  "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
  pilot:  "bg-yellow-500/10  text-yellow-400  border border-yellow-500/20",
  beta:   "bg-cyan-500/10    text-cyan-400    border border-cyan-500/20",
};

export function SolutionCard({ id, title, domain, role, status, description, href }: SolutionCardProps) {
  const card = (
    <div className="glass-card p-5 flex flex-col gap-3 h-full cursor-pointer group">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-widest mb-1" style={{ color: "var(--muted-foreground)" }}>
            {domain}
          </p>
          <h3 className="font-semibold text-base truncate" style={{ color: "var(--foreground)" }}>
            {title}
          </h3>
        </div>
        <span className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-semibold ${statusStyle[status] ?? statusStyle.beta}`}>
          {status}
        </span>
      </div>

      {description && (
        <p className="text-xs leading-relaxed" style={{ color: "var(--muted-foreground)" }}>
          {description}
        </p>
      )}

      <div className="mt-auto flex items-center justify-between">
        <span className="pill-cyan">{role}</span>
        <ArrowRight className="size-4 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: "var(--accent)" }} />
      </div>
    </div>
  );

  if (href) return <Link href={href}>{card}</Link>;
  return card;
}
