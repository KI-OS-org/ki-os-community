import type { MemoryHit, OrbitFile } from "@/lib/adapters/files-memory";

type MemoryPanelProps = {
  activeFile?: OrbitFile;
  query: string;
  hits: MemoryHit[];
};

export function MemoryPanel({ activeFile, query, hits }: MemoryPanelProps) {
  return (
    <div className="space-y-3">
      <div className="rounded-3xl border border-emerald-400/20 bg-emerald-400/5 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-white">Memory Retrieval</div>
            <div className="mt-1 text-xs text-white/55">
              {activeFile ? `Kontext aus ${String(activeFile.name ?? "")}` : "Kein Dateikontext aktiv"}
            </div>
          </div>
          <span className="rounded-full border border-emerald-300/25 px-3 py-1 text-xs text-emerald-100">
            {hits.length} Treffer
          </span>
        </div>
      </div>

      <div className="space-y-2">
        {hits.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/55">
            Keine Treffer für „{query}“ gefunden.
          </div>
        ) : (
          hits.map((hit) => {
            const hitId = String(hit.id ?? "");
            const tags = Array.isArray(hit.tags) ? hit.tags as unknown[] : [];
            return (
            <div key={hitId} className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-medium text-white">{String(hit.title ?? "")}</div>
                  <div className="mt-1 text-xs text-white/45">{String(hit.origin ?? "")}</div>
                </div>
                <span className="rounded-full border border-white/10 px-2 py-1 text-[11px] text-white/65">
                  {String(hit.relevance ?? 0)}% Match
                </span>
              </div>
              <p className="mt-3 text-sm text-white/70">{String(hit.reason ?? "")}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {tags.map((tag, ti) => (
                  <span key={ti} className="rounded-full border border-white/10 px-2 py-1 text-[11px] text-white/55">
                    {String(tag)}
                  </span>
                ))}
              </div>
            </div>
            );
          })
        )}
      </div>
    </div>
  );
}
