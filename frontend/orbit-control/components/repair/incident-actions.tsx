"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { RefreshCw, CheckCircle, CornerDownLeft, Clock } from "lucide-react";

export function IncidentActions({ incidentId, status }: { incidentId: string; status: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function analyze() {
    startTransition(async () => {
      await fetch(`/api/selfrepair/${incidentId}/analyze`, { method: "POST" });
      router.refresh();
    });
  }

  function resolve() {
    if (!confirm("Incident als gelöst markieren?")) return;
    startTransition(async () => {
      await fetch(`/api/selfrepair/${incidentId}/resolve`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({}) });
      router.refresh();
    });
  }

  function defer() {
    startTransition(async () => {
      await fetch(`/api/selfrepair/${incidentId}/defer`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({}) });
      router.refresh();
    });
  }

  const isResolved = status === "resolved" || status === "deferred";

  return (
    <div className="flex flex-wrap items-center gap-2">
      {!isResolved && (
        <>
          <button
            type="button"
            onClick={analyze}
            disabled={pending || status === "analyzing"}
            className="inline-flex items-center gap-2 rounded-[16px] border border-[rgba(90,196,255,0.3)] bg-[rgba(90,196,255,0.08)] px-4 py-2 text-sm text-[var(--accent)] transition hover:bg-[rgba(90,196,255,0.15)] disabled:opacity-50"
          >
            <RefreshCw className="size-4" />
            {status === "analyzing" ? "Analysiert…" : "Analysieren"}
          </button>
          <button
            type="button"
            onClick={resolve}
            disabled={pending}
            className="inline-flex items-center gap-2 rounded-[16px] border border-emerald-500/30 bg-emerald-500/8 px-4 py-2 text-sm text-emerald-300 transition hover:bg-emerald-500/15 disabled:opacity-50"
          >
            <CheckCircle className="size-4" /> Gelöst
          </button>
          <button
            type="button"
            onClick={defer}
            disabled={pending}
            className="inline-flex items-center gap-2 rounded-[16px] border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/60 transition hover:bg-white/10 disabled:opacity-50"
          >
            <Clock className="size-4" /> Zurückstellen
          </button>
        </>
      )}
      {isResolved && (
        <button
          type="button"
          onClick={analyze}
          disabled={pending}
          className="inline-flex items-center gap-2 rounded-[16px] border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/60 transition hover:bg-white/10 disabled:opacity-50"
        >
          <CornerDownLeft className="size-4" /> Neu analysieren
        </button>
      )}
    </div>
  );
}
