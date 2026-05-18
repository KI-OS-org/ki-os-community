"use client";

import { CheckCircle, XCircle, AlertTriangle, ShieldCheck } from "lucide-react";
import { ConfidenceBadge } from "./confidence-badge";

interface PolicyCheck { policy: string; result: string; }
interface VerifierScorePanelProps {
  policyChecks?: PolicyCheck[];
  confidence?: number;
  model?: string;
  escalations?: unknown[];
}

export function VerifierScorePanel({ policyChecks = [], confidence, model, escalations = [] }: VerifierScorePanelProps) {
  const passed  = policyChecks.filter((c) => c.result === "pass").length;
  const failed  = policyChecks.filter((c) => c.result !== "pass").length;
  const needsReview = (confidence !== undefined && confidence < 0.7) || failed > 0 || escalations.length > 0;

  return (
    <div className="glass-card p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-4" style={{ color: "var(--accent)" }} />
          <span className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>Verifier</span>
        </div>
        {confidence !== undefined && <ConfidenceBadge score={confidence} />}
      </div>

      {policyChecks.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>
            Policy Checks ({passed}/{policyChecks.length})
          </p>
          {policyChecks.map((c, i) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              {c.result === "pass"
                ? <CheckCircle className="size-3.5 text-emerald-400 shrink-0" />
                : <XCircle    className="size-3.5 text-red-400 shrink-0" />}
              <span className="font-mono" style={{ color: "var(--foreground)" }}>{c.policy}</span>
              <span className={c.result === "pass" ? "text-emerald-400" : "text-red-400"}>{c.result}</span>
            </div>
          ))}
        </div>
      )}

      {model && (
        <div className="text-xs" style={{ color: "var(--muted-foreground)" }}>
          Modell: <span className="font-mono" style={{ color: "var(--foreground)" }}>{model}</span>
        </div>
      )}

      {needsReview && (
        <div className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs"
          style={{ background: "rgba(234,179,8,0.10)", border: "1px solid rgba(234,179,8,0.25)", color: "#eab308" }}>
          <AlertTriangle className="size-3.5 shrink-0" />
          Second Pass empfohlen — Confidence unter Schwellwert oder Policy-Fehler
        </div>
      )}
    </div>
  );
}
