import React from "react";

interface ConfidenceBadgeProps {
  score?: number;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
}

export function ConfidenceBadge({ score, size = "md", showLabel = true }: ConfidenceBadgeProps) {
  const val = typeof score === "number" ? Math.max(0, Math.min(100, Math.round(score <= 1 ? score * 100 : score))) : 0;
  const color =
    val >= 80 ? { text: "#22c55e", bg: "rgba(34,197,94,0.12)", border: "rgba(34,197,94,0.25)" } :
    val >= 60 ? { text: "#eab308", bg: "rgba(234,179,8,0.12)",  border: "rgba(234,179,8,0.25)" } :
                { text: "#f87171", bg: "rgba(248,113,113,0.12)",border: "rgba(248,113,113,0.25)" };

  const r  = size === "sm" ? 10 : size === "lg" ? 18 : 14;
  const sw = size === "sm" ? 2  : size === "lg" ? 3  : 2.5;
  const circ = 2 * Math.PI * r;
  const dash = (val / 100) * circ;

  const px = size === "sm" ? "px-2 py-0.5 text-[10px]" : size === "lg" ? "px-3 py-1 text-sm" : "px-2.5 py-0.5 text-xs";

  if (typeof score !== "number") return null;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-semibold ${px}`}
      style={{ background: color.bg, border: `1px solid ${color.border}`, color: color.text }}
    >
      <svg width={r * 2 + sw} height={r * 2 + sw} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={r + sw / 2} cy={r + sw / 2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={sw} />
        <circle
          cx={r + sw / 2} cy={r + sw / 2} r={r}
          fill="none" stroke={color.text} strokeWidth={sw}
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
        />
      </svg>
      {showLabel && `${val}%`}
    </span>
  );
}
