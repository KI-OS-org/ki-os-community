type Badge = { label: string; value: string; tone: 'good' | 'warn' | 'neutral' };

export function TrustLensPanel({ trust }: { trust: { badges: Badge[]; summary: string } }) {
  return (
    <aside className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 sticky top-6">
      <h2 className="text-xl font-medium">Trust Lens</h2>
      <p className="text-sm text-slate-400 mt-1">{trust.summary}</p>
      <div className="mt-5 space-y-3">
        {trust.badges.map((badge) => (
          <div key={badge.label} className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
            <div className="text-sm text-slate-400">{badge.label}</div>
            <div className="mt-1 font-medium">{badge.value}</div>
          </div>
        ))}
      </div>
    </aside>
  );
}
