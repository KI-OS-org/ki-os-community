export function SecurityPanel() {
  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-900/80 p-5">
      <h2 className="text-lg font-medium">Security</h2>
      <p className="mt-2 text-sm text-slate-400">PKI Guard, policy violations und privacy posture.</p>
      <div className="mt-4 flex flex-wrap gap-2 text-xs">
        <span className="rounded-full bg-emerald-500/10 text-emerald-300 px-3 py-1">PKI required</span>
        <span className="rounded-full bg-amber-500/10 text-amber-300 px-3 py-1">Regex filter active</span>
        <span className="rounded-full bg-sky-500/10 text-sky-300 px-3 py-1">Privacy masking on</span>
      </div>
    </section>
  );
}
