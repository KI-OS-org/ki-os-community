"use client";

import Link from "next/link";
import { AlertTriangle, Bot } from "lucide-react";

interface AgentLimitBannerProps {
  current: number;
  limit?: number;
  className?: string;
}

export function AgentLimitBanner({ current, limit = 3, className = "" }: AgentLimitBannerProps) {
  const atLimit = current >= limit;
  const pct = Math.min(100, Math.round((current / limit) * 100));

  return (
    <div className={`rounded-xl border px-4 py-3 ${
      atLimit
        ? "border-red-500/30 bg-red-500/10"
        : current === limit - 1
        ? "border-yellow-500/30 bg-yellow-500/10"
        : "border-white/10 bg-white/5"
    } ${className}`}>
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Bot size={15} className={atLimit ? "text-red-400" : current === limit - 1 ? "text-yellow-400" : "text-[#5ac4ff]"} />
          <span className="text-sm font-medium">
            Community Edition ·{" "}
            <span className={atLimit ? "text-red-400" : current === limit - 1 ? "text-yellow-400" : "text-white"}>
              {current}/{limit} Agents
            </span>{" "}
            verwendet
          </span>
        </div>
        {atLimit && (
          <span className="text-xs text-red-400 flex items-center gap-1">
            <AlertTriangle size={12} />
            Limit erreicht
          </span>
        )}
      </div>

      {/* Progress bar */}
      <div className="mt-2.5 h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${
            atLimit ? "bg-red-500" : current === limit - 1 ? "bg-yellow-400" : "bg-[#5ac4ff]"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>

      {atLimit && (
        <p className="mt-2 text-xs text-red-400/80">
          Lösche einen bestehenden Agent oder{" "}
          <Link href="mailto:enterprise@ki-os.org" className="underline hover:text-red-300">
            upgrade auf Enterprise
          </Link>{" "}
          für unbegrenzte Agents.
        </p>
      )}
    </div>
  );
}
