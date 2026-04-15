import React from "react";

export type CapabilityMode = "LIVE" | "PARTIAL" | "DEMO";

export function CapabilityBadge({ mode }: { mode: CapabilityMode }) {
  const map: Record<CapabilityMode, string> = {
    LIVE: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    PARTIAL: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    DEMO: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${map[mode]}`}
      data-capability-mode={mode}
      aria-label={`Capability ${mode}`}
      title={`Capability ${mode}`}
    >
      {mode}
    </span>
  );
}
