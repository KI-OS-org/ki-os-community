type RuntimeEvent = {
  id: string;
  at: string;
  stage: string;
  title: string;
  detail: string;
  severity: 'info' | 'success' | 'warning' | 'critical';
};

export function ExplainPanel({ snapshot }: { snapshot: { primaryRunId: string; events: RuntimeEvent[] } }) {
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-medium">Explain Panel</h2>
          <p className="text-sm text-slate-400">Run {snapshot.primaryRunId}</p>
        </div>
        <span className="text-xs rounded-full border border-cyan-800 px-3 py-1 text-cyan-300">Runtime Event Mapping</span>
      </div>

      <div className="space-y-3">
        {snapshot.events.map((event) => (
          <div key={event.id} className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-sm text-slate-400">{event.at} · {event.stage}</div>
                <div className="font-medium mt-1">{event.title}</div>
              </div>
              <span className="text-xs rounded-full px-2 py-1 border border-slate-700 text-slate-300">{event.severity}</span>
            </div>
            <p className="text-sm text-slate-300 mt-2">{event.detail}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
