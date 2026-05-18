export function IncidentsPanel() {
  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-900/80 p-5">
      <h2 className="text-lg font-medium">Incidents</h2>
      <ul className="mt-4 space-y-3 text-sm text-slate-300">
        <li className="rounded-2xl bg-slate-950 p-3">Anthropic DNS incident • auto-fallback active</li>
        <li className="rounded-2xl bg-slate-950 p-3">1 worker prompt injection caught by DLQ</li>
      </ul>
    </section>
  );
}
