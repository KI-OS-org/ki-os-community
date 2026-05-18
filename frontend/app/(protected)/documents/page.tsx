"use client";

import { useState, useRef } from "react";
import { FileSearch, Upload, FileText, Table, AlertTriangle, CheckCircle, Loader2, X } from "lucide-react";

type ProcessResult = {
  text?: string;
  pages?: number;
  tables?: unknown[][];
  sheets?: Record<string, unknown[][]>;
  error?: string;
  [key: string]: unknown;
};

const ACCEPTED_TYPES = [".pdf", ".xlsx", ".xls"];
const MAX_SIZE_MB = 10;

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Strip data URL prefix: "data:...;base64,"
      resolve(result.split(",")[1] ?? result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function DocumentsPage() {
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ProcessResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFile(f: File) {
    const ext = f.name.split(".").pop()?.toLowerCase();
    if (!ext || !["pdf", "xlsx", "xls"].includes(ext)) {
      setError(`Nicht unterstützter Dateityp: .${ext}. Unterstützt: PDF, XLSX, XLS`);
      return;
    }
    if (f.size > MAX_SIZE_MB * 1024 * 1024) {
      setError(`Datei zu groß (max ${MAX_SIZE_MB} MB)`);
      return;
    }
    setFile(f);
    setResult(null);
    setError(null);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }

  async function processFile() {
    if (!file) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const file_base64 = await fileToBase64(file);
      const ext = file.name.split(".").pop()?.toLowerCase();
      const res = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file_base64, filename: file.name, file_type: ext }),
      });
      const json: ProcessResult = await res.json();
      if (json.error) {
        setError(json.error);
      } else {
        setResult(json);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Verarbeitung fehlgeschlagen");
    } finally {
      setLoading(false);
    }
  }

  const fileExt = file?.name.split(".").pop()?.toLowerCase();
  const isPdf   = fileExt === "pdf";
  const isExcel = fileExt === "xlsx" || fileExt === "xls";

  return (
    <div className="min-h-screen bg-[#0d1117] text-white p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <FileSearch className="text-[#5ac4ff]" size={28} />
          <div>
            <h1 className="text-2xl font-bold">Dokument-Verarbeitung</h1>
            <p className="text-sm text-gray-400">PDF-Text extrahieren und Excel-Daten parsen</p>
          </div>
        </div>

        {/* Upload Zone */}
        <div
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`relative flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-10 cursor-pointer transition-colors ${
            dragging
              ? "border-[#5ac4ff]/60 bg-[#5ac4ff]/5"
              : file
              ? "border-green-500/40 bg-green-500/5"
              : "border-white/15 hover:border-white/30 bg-white/3"
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_TYPES.join(",")}
            className="hidden"
            onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }}
          />

          {file ? (
            <>
              <div className="flex items-center gap-3">
                {isPdf ? (
                  <FileText className="text-red-400" size={32} />
                ) : (
                  <Table className="text-green-400" size={32} />
                )}
                <div>
                  <div className="font-medium">{file.name}</div>
                  <div className="text-xs text-gray-400">{(file.size / 1024).toFixed(1)} KB</div>
                </div>
              </div>
              <button
                onClick={e => { e.stopPropagation(); setFile(null); setResult(null); setError(null); }}
                className="absolute top-3 right-3 p-1 rounded-lg hover:bg-white/10 text-gray-400"
              >
                <X size={14} />
              </button>
            </>
          ) : (
            <>
              <Upload className="text-gray-500" size={32} />
              <div className="text-center">
                <div className="text-sm font-medium text-gray-300">Datei hierher ziehen oder klicken</div>
                <div className="text-xs text-gray-500 mt-1">PDF, XLSX, XLS — max {MAX_SIZE_MB} MB</div>
              </div>
            </>
          )}
        </div>

        {error && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 text-sm">
            <AlertTriangle size={16} className="shrink-0" />
            {error}
          </div>
        )}

        {file && !loading && !result && (
          <button
            onClick={processFile}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[#5ac4ff]/20 border border-[#5ac4ff]/30 text-[#5ac4ff] font-medium hover:bg-[#5ac4ff]/30 transition-colors"
          >
            <FileSearch size={16} />
            Dokument verarbeiten
          </button>
        )}

        {loading && (
          <div className="flex items-center justify-center gap-3 py-8 text-gray-400 text-sm">
            <Loader2 className="animate-spin" size={20} />
            Verarbeite Dokument...
          </div>
        )}

        {/* Results */}
        {result && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-green-400 text-sm">
              <CheckCircle size={16} />
              <span>Verarbeitung abgeschlossen</span>
              {isPdf && result.pages && (
                <span className="text-gray-400">· {result.pages} Seite{result.pages !== 1 ? "n" : ""}</span>
              )}
            </div>

            {/* PDF: extracted text */}
            {isPdf && result.text && (
              <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-2">
                <div className="text-xs text-gray-400 font-medium flex items-center gap-1">
                  <FileText size={12} />
                  Extrahierter Text
                </div>
                <pre className="text-sm text-gray-200 whitespace-pre-wrap font-mono leading-relaxed max-h-96 overflow-y-auto">
                  {result.text}
                </pre>
              </div>
            )}

            {/* Excel: sheets */}
            {isExcel && result.sheets && Object.entries(result.sheets).map(([sheetName, rows]) => (
              <div key={sheetName} className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
                <div className="text-xs text-gray-400 font-medium flex items-center gap-1">
                  <Table size={12} />
                  Sheet: {sheetName}
                  <span className="ml-2 text-gray-500">· {Array.isArray(rows) ? rows.length : 0} Zeilen</span>
                </div>
                {Array.isArray(rows) && rows.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="text-xs text-gray-300 border-collapse w-full">
                      <thead>
                        <tr>
                          {Array.isArray(rows[0]) && (rows[0] as unknown[]).map((cell, i) => (
                            <th key={i} className="border border-white/10 px-2 py-1 text-left bg-white/5 font-medium">
                              {String(cell ?? "")}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {rows.slice(1, 51).map((row, ri) => (
                          <tr key={ri} className="hover:bg-white/3">
                            {Array.isArray(row) && (row as unknown[]).map((cell, ci) => (
                              <td key={ci} className="border border-white/5 px-2 py-1">
                                {String(cell ?? "")}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {Array.isArray(rows) && rows.length > 51 && (
                      <div className="text-xs text-gray-500 mt-2">
                        + {rows.length - 51} weitere Zeilen (nur erste 50 angezeigt)
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}

            {/* Fallback: raw JSON */}
            {!result.text && !result.sheets && (
              <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-2">
                <div className="text-xs text-gray-400 font-medium">Ergebnis (Raw)</div>
                <pre className="text-xs text-gray-300 whitespace-pre-wrap font-mono max-h-64 overflow-y-auto">
                  {JSON.stringify(result, null, 2)}
                </pre>
              </div>
            )}

            <button
              onClick={() => { setFile(null); setResult(null); }}
              className="text-sm text-gray-400 hover:text-white transition-colors"
            >
              Neues Dokument verarbeiten
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
