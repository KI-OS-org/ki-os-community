import type { OrbitFile } from "@/lib/adapters/files-memory";

type FileListProps = {
  files: OrbitFile[];
  selectedId?: string;
  onSelect: (id: string) => void;
};

export function FileList({ files, selectedId, onSelect }: FileListProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-white">Dateiliste</h3>
        <span className="text-xs text-white/45">{files.length} Dateien</span>
      </div>
      <div className="space-y-2">
        {files.map((file) => {
          const id = String(file.id ?? "");
          const active = id === selectedId;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onSelect(id)}
              className={`w-full rounded-2xl border p-3 text-left transition ${
                active
                  ? "border-cyan-400/40 bg-cyan-400/10"
                  : "border-white/10 bg-white/5 hover:bg-white/10"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-medium text-white">{String(file.name ?? "")}</div>
                  <div className="mt-1 text-xs text-white/45">
                    {String(file.typeLabel ?? "")} · {String(file.sizeLabel ?? "")} · {String(file.source ?? "")}
                  </div>
                </div>
                <span className="rounded-full border border-white/10 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-white/55">
                  {String(file.status ?? "")}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
