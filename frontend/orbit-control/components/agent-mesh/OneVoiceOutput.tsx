"use client";

/**
 * KI-OS · One Voice Output Panel
 * Erscheint mit Framer Motion wenn Phase === COMPLETE.
 * Zeigt die synthetisierten Ergebniszeilen an.
 */
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, Sparkles } from "lucide-react";
import type { MeshPhase } from "@/lib/mesh-store";

interface Props {
  phase: MeshPhase;
  output: string[];
  taskDescription?: string;
}

export function OneVoiceOutput({ phase, output, taskDescription }: Props) {
  const isVisible = phase === "COMPLETE" && output.length > 0;

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 16, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          className="rounded-xl overflow-hidden"
          style={{
            background: "linear-gradient(135deg, rgba(5,8,22,0.95), rgba(8,12,30,0.95))",
            border:     "1px solid rgba(90,196,255,0.3)",
            boxShadow:  "0 0 40px rgba(90,196,255,0.08), 0 8px 32px rgba(0,0,0,0.5)",
          }}
        >
          {/* Header */}
          <div
            className="px-5 py-3 flex items-center gap-3"
            style={{
              background:   "linear-gradient(90deg, rgba(90,196,255,0.08), transparent)",
              borderBottom: "1px solid rgba(90,196,255,0.15)",
            }}
          >
            <div
              className="flex items-center justify-center size-8 rounded-lg shrink-0"
              style={{ background: "rgba(90,196,255,0.1)", border: "1px solid rgba(90,196,255,0.25)" }}
            >
              <Sparkles className="size-4" style={{ color: "#5ac4ff" }} />
            </div>
            <div>
              <div
                style={{
                  fontFamily:    "'JetBrains Mono', monospace",
                  fontSize:      10,
                  color:         "#5ac4ff",
                  letterSpacing: 2,
                  textTransform: "uppercase",
                }}
              >
                One Voice Output
              </div>
              {taskDescription && (
                <div className="text-xs mt-0.5 truncate max-w-xs" style={{ color: "#6874a0" }}>
                  {taskDescription}
                </div>
              )}
            </div>
            <div className="ml-auto flex items-center gap-1.5">
              <CheckCircle2 className="size-4" style={{ color: "#22c55e" }} />
              <span
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize:   10,
                  color:      "#22c55e",
                }}
              >
                VERIFIED
              </span>
            </div>
          </div>

          {/* Output lines */}
          <div className="px-5 py-4 space-y-3">
            {output.map((line, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.12, duration: 0.25 }}
                className="flex items-start gap-3"
              >
                <span
                  className="shrink-0 mt-0.5 size-5 rounded-full flex items-center justify-center text-xs font-bold"
                  style={{
                    background: "rgba(90,196,255,0.1)",
                    border:     "1px solid rgba(90,196,255,0.2)",
                    color:      "#5ac4ff",
                  }}
                >
                  {i + 1}
                </span>
                <p className="text-sm leading-relaxed" style={{ color: "#e0e8ff" }}>
                  {line}
                </p>
              </motion.div>
            ))}
          </div>

          {/* Footer / Governance stamp */}
          <div
            className="px-5 py-2.5 flex items-center gap-4"
            style={{ borderTop: "1px solid rgba(255,255,255,0.05)", background: "rgba(0,0,0,0.15)" }}
          >
            <div className="flex items-center gap-1.5">
              <span
                className="size-1.5 rounded-full"
                style={{ background: "#22c55e" }}
              />
              <span
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize:   9,
                  color:      "#4a5272",
                  letterSpacing: 1,
                }}
              >
                DSGVO ✓
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span
                className="size-1.5 rounded-full"
                style={{ background: "#22c55e" }}
              />
              <span
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize:   9,
                  color:      "#4a5272",
                  letterSpacing: 1,
                }}
              >
                POLICY ✓
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span
                className="size-1.5 rounded-full"
                style={{ background: "#22c55e" }}
              />
              <span
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize:   9,
                  color:      "#4a5272",
                  letterSpacing: 1,
                }}
              >
                AUDIT-LOG ✓
              </span>
            </div>
            <span
              className="ml-auto"
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize:   9,
                color:      "#2a3562",
              }}
            >
              Kimba · One Voice
            </span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
