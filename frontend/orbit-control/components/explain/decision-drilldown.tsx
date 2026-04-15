// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function DecisionDrilldown({ decision }: { decision: any }) {
  if (!decision) {
    return (
      <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-sm">
        <h2 className="text-xl font-medium">Entscheidungs-Drilldown</h2>
        <p className="text-sm text-slate-400 mt-1">Keine Entscheidungsdaten verfügbar.</p>
      </section>
    );
  }
  const steps: Array<{ label: string; detail: string }> = Array.isArray(decision.steps) ? decision.steps : [];
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-sm">
      <h2 className="text-xl font-medium">Entscheidungs-Drilldown</h2>
      <p className="text-sm text-slate-400 mt-1">{String(decision.title ?? "")}</p>
      <ol className="mt-4 space-y-3">
        {steps.map((step, index) => (
          <li key={step.label ?? index} className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
            <div className="text-sm text-slate-400">Schritt {index + 1}</div>
            <div className="font-medium mt-1">{step.label}</div>
            <p className="text-sm text-slate-300 mt-2">{step.detail}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
