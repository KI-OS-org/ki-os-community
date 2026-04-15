import type { OrbitFile } from "@/lib/adapters/files-memory";

type FilePreviewPanelProps = {
  file?: OrbitFile;
};

export function FilePreviewPanel({ file }: FilePreviewPanelProps) {
  if (!file) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/5 p-4 text-sm text-white/55">
        Noch keine Datei ausgewählt.
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-white/45">Vorschau</p>
          <h3 className="mt-2 text-lg font-semibold text-white">{String(file.name ?? "")}</h3>
        </div>
        <span className="rounded-full border border-cyan-300/25 px-3 py-1 text-xs text-cyan-100">
          Relevanz {String(file.relevance ?? 0)}%
        </span>
      </div>
      <p className="mt-3 text-sm text-white/65">{String(file.preview ?? "")}</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Meta label="Herkunft" value={String(file.origin ?? "")} />
        <Meta label="Memory Save" value={file.memorySaved ? "aktiv" : "ausstehend"} />
        <Meta label="Tags" value={Array.isArray(file.tags) ? (file.tags as string[]).join(", ") : ""} />
        <Meta label="Zuletzt genutzt" value={String(file.lastAccessed ?? "")} />
      </div>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
      <div className="text-xs uppercase tracking-[0.18em] text-white/40">{label}</div>
      <div className="mt-2 text-sm text-white/80">{value}</div>
    </div>
  );
}
