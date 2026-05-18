"use client";

import { useRef } from "react";
import { createOrbitFilesFromSelection, type OrbitFile } from "@/lib/adapters/files-memory";

type UploadDropzoneProps = {
  onFilesPrepared: (files: OrbitFile[]) => void;
};

export function UploadDropzone({ onFilesPrepared }: UploadDropzoneProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  return (
    <div className="rounded-3xl border border-dashed border-cyan-400/35 bg-cyan-500/5 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-base font-semibold text-white">Upload & Memory Save</h3>
          <p className="mt-1 text-sm text-white/60">
            PDF, CSV, Bilder oder Notizen hochladen. Neue Dateien werden sofort im Workspace und im Memory-Kontext sichtbar.
          </p>
        </div>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="rounded-2xl border border-cyan-300/30 bg-cyan-400/10 px-4 py-2 text-sm font-medium text-cyan-100 transition hover:bg-cyan-400/20"
        >
          Dateien auswählen
        </button>
      </div>
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(event) => {
          const nextFiles = createOrbitFilesFromSelection(Array.from(event.target.files ?? []));
          onFilesPrepared(nextFiles);
          event.currentTarget.value = "";
        }}
      />
    </div>
  );
}
