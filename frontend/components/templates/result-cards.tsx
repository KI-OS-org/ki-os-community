export type OrbitResultCard = {
  id: string;
  title: string;
  summary: string;
  status: 'ready' | 'review' | 'attention';
};

export function ResultCards({ cards }: { cards: OrbitResultCard[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {cards.map((card) => (
        <article key={card.id} className="rounded-2xl border border-white/10 bg-slate-900 p-4">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="font-medium text-white">{card.title}</h3>
            <span className="text-xs text-cyan-300">{card.status}</span>
          </div>
          <p className="text-sm text-slate-300">{card.summary}</p>
        </article>
      ))}
    </div>
  );
}
