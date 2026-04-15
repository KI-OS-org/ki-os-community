/* eslint-disable @typescript-eslint/no-explicit-any */
export const dynamic = "force-dynamic";

import { ExplainPanel } from '@/components/explain/explain-panel';
import { TrustLensPanel } from '@/components/explain/trust-lens-panel';
import { DecisionDrilldown } from '@/components/explain/decision-drilldown';
import { explainAdapter } from '@/lib/adapters/explain-trust';

export default async function ExplainModePage() {
  const [snapshotRaw, trustRaw] = await Promise.allSettled([
    explainAdapter.getExplainSnapshot(),
    explainAdapter.getTrustLens(),
  ]);
  const snapshotData = snapshotRaw.status === "fulfilled" ? snapshotRaw.value : null;
  const runId = String((snapshotData as Record<string, unknown>)?.primaryRunId ?? (snapshotData as Record<string, unknown>)?.runId ?? "");
  const decisionRaw = await explainAdapter.getDecisionDrilldown(runId).catch(() => null);

  const snapshot = {
    primaryRunId: runId,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    events: (Array.isArray((snapshotData as any)?.events) ? (snapshotData as any).events : []) as any[],
  };
  const trust = trustRaw.status === "fulfilled" ? trustRaw.value : null;
  const decision = decisionRaw;

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-6 space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Explain Mode &amp; Trust Lens</h1>
        <p className="text-slate-400 max-w-3xl">
          Entscheidungen, Schutzmechaniken und Laufzeit-Ereignisse werden hier in verständlicher Form sichtbar.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-6">
          <ExplainPanel snapshot={snapshot} />
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          <DecisionDrilldown decision={decision as any} />
        </div>
        <div>
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          <TrustLensPanel trust={trust as any} />
        </div>
      </div>
    </main>
  );
}
