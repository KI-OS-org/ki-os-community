"use client";

import { useState, useEffect, useCallback, useRef, useTransition } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Download,
  File,
  FileText,
  Image,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
  Upload,
  X,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface FileRecord {
  id?: string;
  fileId?: string;
  name?: string;
  filename?: string;
  size?: number;
  mimeType?: string;
  type?: string;
  contentType?: string;
  tags?: string[];
  createdAt?: string;
  uploadedAt?: string;
  userId?: string;
  downloadUrl?: string;
  content?: string;
  [key: string]: unknown;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fileId(f: FileRecord) {
  return f.fileId ?? f.id ?? "";
}

function fileName(f: FileRecord) {
  return f.name ?? f.filename ?? "Unnamed file";
}

function fileType(f: FileRecord) {
  return f.mimeType ?? f.type ?? f.contentType ?? "unknown";
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("de-DE", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtSize(bytes: number | undefined) {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function FileIcon({ mimeType }: { mimeType: string }) {
  if (mimeType.startsWith("image/"))
    return <Image className="size-4" style={{ color: "#5ac4ff" }} />;
  if (mimeType.includes("pdf") || mimeType.includes("text"))
    return <FileText className="size-4" style={{ color: "#a855f7" }} />;
  return <File className="size-4" style={{ color: "var(--muted-foreground)" }} />;
}

// ── UploadZone ────────────────────────────────────────────────────────────────

function UploadZone({
  onUpload,
  uploading,
}: {
  onUpload: (file: File) => void;
  uploading: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) onUpload(f);
  };

  return (
    <div
      className="rounded-2xl border-2 border-dashed p-8 text-center transition-colors cursor-pointer"
      style={{
        borderColor: dragging ? "var(--accent)" : "rgba(255,255,255,0.12)",
        background: dragging
          ? "rgba(90,196,255,0.05)"
          : "rgba(255,255,255,0.02)",
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onUpload(f);
        }}
      />
      {uploading ? (
        <Loader2
          className="size-8 mx-auto mb-2 animate-spin"
          style={{ color: "var(--accent)" }}
        />
      ) : (
        <Upload
          className="size-8 mx-auto mb-2"
          style={{ color: "var(--accent)", opacity: 0.6 }}
        />
      )}
      <p className="text-sm font-medium text-[var(--foreground)]">
        {uploading ? "Uploading…" : "Drop a file or click to upload"}
      </p>
      <p className="text-xs text-[var(--muted-foreground)] mt-1">
        Any file type accepted
      </p>
    </div>
  );
}

// ── FileDetail ────────────────────────────────────────────────────────────────

function FileDetail({
  file,
  onClose,
  onDelete,
  deleting,
}: {
  file: FileRecord;
  onClose: () => void;
  onDelete: (id: string) => void;
  deleting: boolean;
}) {
  return (
    <div
      className="glass-card p-5 space-y-4"
      style={{ borderLeft: "3px solid var(--accent)" }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <FileIcon mimeType={fileType(file)} />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[var(--foreground)] truncate">
              {fileName(file)}
            </p>
            <p className="text-xs text-[var(--muted-foreground)] font-mono">
              {fileId(file)}
            </p>
          </div>
        </div>
        <button onClick={onClose} className="rounded-lg p-1 hover:opacity-60 shrink-0">
          <X className="size-4 text-[var(--muted-foreground)]" />
        </button>
      </div>

      {/* Meta */}
      <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
        {[
          { label: "Size", value: fmtSize(file.size) },
          { label: "Type", value: fileType(file) },
          { label: "Uploaded", value: fmtDate(file.createdAt ?? file.uploadedAt) },
          { label: "User", value: file.userId ?? "—" },
        ].map((m) => (
          <div
            key={m.label}
            className="rounded-xl px-3 py-2"
            style={{ background: "rgba(255,255,255,0.04)" }}
          >
            <p className="text-[var(--muted-foreground)]">{m.label}</p>
            <p className="font-medium text-[var(--foreground)] truncate mt-0.5">{m.value}</p>
          </div>
        ))}
      </div>

      {/* Tags */}
      {Array.isArray(file.tags) && file.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {file.tags.map((tag, i) => (
            <span
              key={i}
              className="rounded-full px-2.5 py-0.5 text-xs"
              style={{
                background: "rgba(90,196,255,0.1)",
                border: "1px solid rgba(90,196,255,0.2)",
                color: "#5ac4ff",
              }}
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Content preview */}
      {file.content && (
        <div>
          <p className="text-xs text-[var(--muted-foreground)] font-medium uppercase tracking-wider mb-2">
            Content Preview
          </p>
          <pre
            className="text-xs rounded-xl p-3 overflow-auto max-h-40 whitespace-pre-wrap"
            style={{
              background: "rgba(0,0,0,0.3)",
              border: "1px solid rgba(255,255,255,0.06)",
              color: "var(--foreground)",
            }}
          >
            {String(file.content).slice(0, 2000)}
          </pre>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        {file.downloadUrl && (
          <a
            href={file.downloadUrl}
            download={fileName(file)}
            className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-medium"
            style={{
              background: "rgba(34,197,94,0.1)",
              border: "1px solid rgba(34,197,94,0.25)",
              color: "#22c55e",
            }}
          >
            <Download className="size-3.5" />
            Download
          </a>
        )}
        <button
          onClick={() => onDelete(fileId(file))}
          disabled={deleting}
          className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-medium disabled:opacity-50"
          style={{
            background: "rgba(248,113,113,0.1)",
            border: "1px solid rgba(248,113,113,0.25)",
            color: "#f87171",
          }}
        >
          <Trash2 className="size-3.5" />
          {deleting ? "Deleting…" : "Delete"}
        </button>
      </div>
    </div>
  );
}

// ── DeleteConfirmModal ────────────────────────────────────────────────────────

function DeleteConfirmDialog({
  name,
  onConfirm,
  onCancel,
}: {
  name: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.7)" }}
    >
      <div
        className="glass-card p-6 space-y-4 max-w-sm w-full"
        style={{ borderLeft: "3px solid #f87171" }}
      >
        <div className="flex items-center gap-2">
          <AlertCircle className="size-5" style={{ color: "#f87171" }} />
          <h3 className="font-semibold text-[var(--foreground)]">Delete File?</h3>
        </div>
        <p className="text-sm text-[var(--muted-foreground)]">
          Are you sure you want to delete{" "}
          <span className="font-semibold text-[var(--foreground)]">{name}</span>? This
          cannot be undone.
        </p>
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded-lg px-4 py-2 text-xs text-[var(--muted-foreground)] hover:opacity-60"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-medium"
            style={{
              background: "rgba(248,113,113,0.15)",
              border: "1px solid rgba(248,113,113,0.3)",
              color: "#f87171",
            }}
          >
            <Trash2 className="size-3.5" />
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function FilesPage() {
  const [files, setFiles] = useState<FileRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<FileRecord | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadOk, setUploadOk] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<FileRecord | null>(null);
  const [, startTransition] = useTransition();

  const fetchFiles = useCallback(async () => {
    try {
      const res = await fetch("/api/files");
      const json = await res.json().catch(() => ({}));
      const list: FileRecord[] = Array.isArray(json?.files)
        ? json.files
        : Array.isArray(json)
        ? json
        : [];
      setFiles(list);
      setError(null);
    } catch {
      setError("Failed to load files");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  const handleUpload = async (file: File) => {
    setUploading(true);
    setUploadOk(false);
    try {
      // Read file as base64 for JSON transport
      const reader = new FileReader();
      const content = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      await fetch("/api/files/upload", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: file.name,
          mimeType: file.type || "application/octet-stream",
          size: file.size,
          content,
        }),
      });

      setUploadOk(true);
      setShowUpload(false);
      await fetchFiles();
      setTimeout(() => setUploadOk(false), 3000);
    } catch {
      /* ignore */
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    setConfirmDelete(null);
    try {
      await fetch(`/api/files/${id}`, { method: "DELETE" });
      if (selectedFile && fileId(selectedFile) === id) setSelectedFile(null);
      await fetchFiles();
    } catch {
      /* ignore */
    } finally {
      setDeletingId(null);
    }
  };

  const handleRowClick = (f: FileRecord) => {
    if (selectedFile && fileId(selectedFile) === fileId(f)) {
      setSelectedFile(null);
      return;
    }
    setSelectedFile(f);
    // Fetch fresh detail
    startTransition(async () => {
      const id = fileId(f);
      if (!id) return;
      const res = await fetch(`/api/files/${id}`).catch(() => null);
      if (!res) return;
      const json = await res.json().catch(() => null);
      const detail: FileRecord = json?.item ?? json;
      if (detail?.id ?? detail?.fileId) setSelectedFile(detail);
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="size-6 animate-spin" style={{ color: "var(--accent)" }} />
      </div>
    );
  }

  return (
    <div className="space-y-5 p-6">
      {/* Delete confirm modal */}
      {confirmDelete && (
        <DeleteConfirmDialog
          name={fileName(confirmDelete)}
          onConfirm={() => handleDelete(fileId(confirmDelete!))}
          onCancel={() => setConfirmDelete(null)}
        />
      )}

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)] flex items-center gap-2">
            <FileText className="size-6" style={{ color: "var(--accent)" }} />
            Files
          </h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">
            Upload, browse, preview and manage files
          </p>
        </div>

        <div className="flex items-center gap-2">
          {uploadOk && (
            <span className="flex items-center gap-1 text-xs" style={{ color: "#22c55e" }}>
              <CheckCircle2 className="size-3.5" />
              Uploaded
            </span>
          )}
          <button
            onClick={fetchFiles}
            className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs transition-opacity hover:opacity-70"
            style={{
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "var(--muted-foreground)",
            }}
          >
            <RefreshCw className="size-3.5" />
            Refresh
          </button>
          <button
            onClick={() => setShowUpload((v) => !v)}
            className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-medium"
            style={{
              background: "rgba(90,196,255,0.15)",
              border: "1px solid rgba(90,196,255,0.3)",
              color: "var(--accent)",
            }}
          >
            <Plus className="size-3.5" />
            Upload File
          </button>
        </div>
      </div>

      {/* Upload zone */}
      {showUpload && (
        <UploadZone onUpload={handleUpload} uploading={uploading} />
      )}

      {error && (
        <div
          className="glass-card p-4 flex items-center gap-2 text-sm"
          style={{ borderLeft: "3px solid #f87171", color: "#f87171" }}
        >
          <AlertCircle className="size-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Selected file detail */}
      {selectedFile && (
        <FileDetail
          file={selectedFile}
          onClose={() => setSelectedFile(null)}
          onDelete={(id) => setConfirmDelete(selectedFile)}
          deleting={deletingId === fileId(selectedFile)}
        />
      )}

      {/* File list */}
      <div className="glass-card overflow-hidden">
        <div
          className="px-5 py-3 border-b flex items-center justify-between"
          style={{ borderColor: "rgba(255,255,255,0.06)" }}
        >
          <span className="text-sm font-semibold text-[var(--foreground)]">
            Files
          </span>
          <span className="text-xs text-[var(--muted-foreground)]">
            {files.length} total
          </span>
        </div>

        {files.length === 0 ? (
          <div className="p-10 text-center">
            <Upload
              className="size-10 mx-auto mb-3"
              style={{ color: "var(--accent)", opacity: 0.3 }}
            />
            <p className="text-sm text-[var(--muted-foreground)]">
              No files yet. Upload the first one.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                  {["Name", "Size", "Type", "Uploaded", ""].map((h) => (
                    <th
                      key={h}
                      className="text-left px-5 py-2.5 font-medium text-[var(--muted-foreground)]"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {files.map((f) => {
                  const id = fileId(f);
                  const isSelected = selectedFile && fileId(selectedFile) === id;
                  return (
                    <tr
                      key={id}
                      className="cursor-pointer transition-colors"
                      style={{
                        borderBottom: "1px solid rgba(255,255,255,0.04)",
                        background: isSelected
                          ? "rgba(90,196,255,0.05)"
                          : undefined,
                      }}
                      onClick={() => handleRowClick(f)}
                    >
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <FileIcon mimeType={fileType(f)} />
                          <span className="font-medium text-[var(--foreground)] truncate max-w-[200px]">
                            {fileName(f)}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-[var(--muted-foreground)]">
                        {fmtSize(f.size)}
                      </td>
                      <td className="px-5 py-3 text-[var(--muted-foreground)] font-mono">
                        {fileType(f)}
                      </td>
                      <td className="px-5 py-3 text-[var(--muted-foreground)]">
                        {fmtDate(f.createdAt ?? f.uploadedAt)}
                      </td>
                      <td className="px-5 py-3">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setConfirmDelete(f);
                          }}
                          disabled={deletingId === id}
                          className="rounded-lg p-1.5 transition-opacity hover:opacity-70 disabled:opacity-30"
                          style={{
                            background: "rgba(248,113,113,0.08)",
                            color: "#f87171",
                          }}
                        >
                          {deletingId === id ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="size-3.5" />
                          )}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
