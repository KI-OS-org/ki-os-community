"use client";

import { useMemo, useState } from "react";
import { UploadDropzone } from "@/components/files/upload-dropzone";
import { FileList } from "@/components/files/file-list";
import { FilePreviewPanel } from "@/components/files/file-preview-panel";
import { MemoryPanel } from "@/components/files/memory-panel";
import { MemoryGraph } from "@/components/files/memory-graph";
import {
  demoFiles,
  demoMemoryHits,
  demoMemoryGraph,
  type OrbitFile,
} from "@/lib/adapters/files-memory";

export function FileMemoryWorkspace() {
  const [files, setFiles] = useState<OrbitFile[]>(demoFiles);
  const [selectedFileId, setSelectedFileId] = useState<string>(String(demoFiles[0]?.id ?? ""));
  const [search, setSearch] = useState("Umsatzentwicklung März");

  const selectedFile = useMemo(
    () => files.find((file) => file.id === selectedFileId) ?? files[0],
    [files, selectedFileId],
  );

  const handleAddFiles = (incoming: OrbitFile[]) => {
    const merged = [...incoming, ...files];
    setFiles(merged);
    if (incoming[0]) setSelectedFileId(String(incoming[0].id ?? ""));
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[1.2fr_0.9fr_1fr]">
      <section className="space-y-4 rounded-3xl border border-white/10 bg-black/30 p-4 backdrop-blur">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-white/45">Workspace</p>
          <h1 className="mt-2 text-2xl font-semibold text-white">Dateien & Memory</h1>
          <p className="mt-2 max-w-xl text-sm text-white/65">
            Dateien hochladen, Quellen prüfen und relevante Gedächtnis-Treffer direkt im Arbeitsraum weiterverwenden.
          </p>
        </div>
        <UploadDropzone onFilesPrepared={handleAddFiles} />
        <FileList files={files} selectedId={selectedFileId} onSelect={setSelectedFileId} />
      </section>

      <section className="space-y-4 rounded-3xl border border-white/10 bg-black/30 p-4 backdrop-blur">
        <FilePreviewPanel file={selectedFile} />
        <MemoryGraph graph={demoMemoryGraph} activeId={selectedFile?.id != null ? String(selectedFile.id) : undefined} />
      </section>

      <section className="space-y-4 rounded-3xl border border-white/10 bg-black/30 p-4 backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-white/45">Retrieval</p>
            <h2 className="mt-2 text-lg font-semibold text-white">Memory Panel</h2>
          </div>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="w-full max-w-xs rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none placeholder:text-white/30"
            placeholder="Wonach suchst du?"
          />
        </div>
        <MemoryPanel
          activeFile={selectedFile}
          query={search}
          hits={demoMemoryHits.filter((hit) =>
            [hit.title, hit.reason, hit.origin].join(" ").toLowerCase().includes(search.toLowerCase()),
          )}
        />
      </section>
    </div>
  );
}
