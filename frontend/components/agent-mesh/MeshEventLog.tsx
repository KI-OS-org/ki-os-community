"use client";

/**
 * KI-OS · AgentMesh Event Log
 * Ring-Buffer (max 60 events). Neue Events oben. Auto-scroll.
 */
import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { MeshEvent } from "@/lib/mesh-store";

const EVENT_ICONS: Record<MeshEvent["type"], string> = {
  dispatch:  "→",
  result:    "✓",
  error:     "✗",
  synthesis: "⬡",
  policy:    "⊕",
  output:    "◉",
  info:      "·",
};

const EVENT_COLORS: Record<MeshEvent["type"], string> = {
  dispatch:  "#5ac4ff",
  result:    "#22c55e",
  error:     "#f87171",
  synthesis: "#a78bfa",
  policy:    "#fbbf24",
  output:    "#5ac4ff",
  info:      "#4a5272",
};

function fmtTime(ts: number) {
  return new Date(ts).toLocaleTimeString("de-DE", {
    hour:   "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

interface Props {
  events: MeshEvent[];
  maxHeight?: number;
}

export function MeshEventLog({ events, maxHeight = 320 }: Props) {
  const listRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to top on new events
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = 0;
    }
  }, [events.length]);

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        background: "rgba(5,8,22,0.85)",
        border:     "1px solid rgba(90,196,255,0.12)",
        backdropFilter: "blur(4px)",
      }}
    >
      {/* Header */}
      <div
        className="px-4 py-2.5 flex items-center justify-between"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
      >
        <div className="flex items-center gap-2">
          <span className="size-1.5 rounded-full animate-pulse" style={{ background: "#5ac4ff" }} />
          <span
            style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "#5ac4ff", letterSpacing: 1.5 }}
          >
            EVENT STREAM
          </span>
        </div>
        <span
          style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: "#4a5272" }}
        >
          {events.length} events
        </span>
      </div>

      {/* Event list */}
      <div
        ref={listRef}
        className="overflow-y-auto custom-scrollbar"
        style={{ maxHeight, overflowX: "hidden" }}
      >
        {events.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <span style={{ fontSize: 12, color: "#4a5272" }}>Warte auf Events…</span>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {events.map((ev) => (
              <motion.div
                key={ev.id}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="px-4 py-2 flex items-start gap-3"
                style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}
              >
                <span
                  className="shrink-0 mt-0.5"
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 11,
                    color: EVENT_COLORS[ev.type],
                    minWidth: 12,
                  }}
                >
                  {EVENT_ICONS[ev.type]}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs leading-relaxed" style={{ color: "#a9b7e6" }}>
                    {ev.message}
                  </p>
                  {ev.agentId && (
                    <span
                      style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: 9,
                        color: "#4a5272",
                      }}
                    >
                      {ev.agentId}
                    </span>
                  )}
                </div>
                <span
                  className="shrink-0 mt-0.5"
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 9,
                    color: "#2a3562",
                    whiteSpace: "nowrap",
                  }}
                >
                  {fmtTime(ev.ts)}
                </span>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
