export function SupervisorMeshPanel() {
  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-900/80 p-5">
      <h2 className="text-lg font-medium">Supervisor Mesh</h2>
      <div className="mt-4 grid gap-3 md:grid-cols-4 text-sm">
        <div className="rounded-2xl bg-slate-950 p-3">Workers active: 6</div>
        <div className="rounded-2xl bg-slate-950 p-3">Escalations: 2</div>
        <div className="rounded-2xl bg-slate-950 p-3">Auto-heal: enabled</div>
        <div className="rounded-2xl bg-slate-950 p-3">Mesh state: stable</div>
      </div>
    </section>
  );
}
