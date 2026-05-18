export function HealthPanel() {
  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-900/80 p-5">
      <h2 className="text-lg font-medium">Health</h2>
      <p className="mt-2 text-sm text-slate-400">Provider-Status, Runtime Health und Circuit-Breaker-Sicht.</p>
      <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
        <div className="rounded-2xl bg-slate-950 p-3"><div className="text-slate-400">Providers up</div><div className="mt-1 text-xl">4/5</div></div>
        <div className="rounded-2xl bg-slate-950 p-3"><div className="text-slate-400">Runtime</div><div className="mt-1 text-xl">healthy</div></div>
        <div className="rounded-2xl bg-slate-950 p-3"><div className="text-slate-400">Auto refresh</div><div className="mt-1 text-xl">15s</div></div>
      </div>
    </section>
  );
}
