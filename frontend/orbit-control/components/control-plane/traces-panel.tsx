export function TracesPanel() {
  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-900/80 p-5">
      <h2 className="text-lg font-medium">Traces</h2>
      <p className="mt-2 text-sm text-slate-400">Runtime traces, latency and exporter state.</p>
      <div className="mt-4 rounded-2xl bg-slate-950 p-3 text-sm text-slate-300">OTel exporter registered • external OTLP pending</div>
    </section>
  );
}
