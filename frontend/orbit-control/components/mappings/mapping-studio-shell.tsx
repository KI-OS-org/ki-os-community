"use client";

import { useState } from "react";
import { ArrowRight, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type FieldEntry = { name: string; type: string };
type MappingPair = { from: string; to: string };

interface MappingStudioShellProps {
  sourceFields?: string[];
  targetFields?: string[];
  mappings?: MappingPair[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function parseFields(raw?: string[]): FieldEntry[] {
  if (!raw?.length) return [];
  return raw.map((f) => {
    const parts = f.split(":");
    return { name: parts[0] ?? f, type: parts[1] ?? "string" };
  });
}

const typeColor: Record<string, string> = {
  string: "text-sky-300",
  number: "text-amber-300",
  boolean: "text-emerald-300",
  date: "text-purple-300",
  object: "text-pink-300",
  array: "text-orange-300",
};

function TypeBadge({ type }: { type: string }) {
  return (
    <span className={cn("text-[10px] font-mono", typeColor[type] ?? "text-[var(--muted-foreground)]")}>
      {type}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export function MappingStudioShell({
  sourceFields: rawSource,
  targetFields: rawTarget,
  mappings: initialMappings = [],
}: MappingStudioShellProps) {
  const sourceFields = parseFields(
    rawSource ?? ["id:string", "name:string", "email:string", "createdAt:date", "active:boolean"],
  );
  const targetFields = parseFields(
    rawTarget ?? ["userId:string", "displayName:string", "mail:string", "registeredAt:date", "enabled:boolean"],
  );

  const [mappings, setMappings] = useState<MappingPair[]>(initialMappings);
  const [selectedSource, setSelectedSource] = useState<string | null>(null);
  const [selectedTarget, setSelectedTarget] = useState<string | null>(null);

  function addMapping() {
    if (!selectedSource || !selectedTarget) return;
    const already = mappings.some(
      (m) => m.from === selectedSource && m.to === selectedTarget,
    );
    if (!already) {
      setMappings((prev) => [...prev, { from: selectedSource, to: selectedTarget }]);
    }
    setSelectedSource(null);
    setSelectedTarget(null);
  }

  function removeMapping(index: number) {
    setMappings((prev) => prev.filter((_, i) => i !== index));
  }

  const mappedSources = new Set(mappings.map((m) => m.from));
  const mappedTargets = new Set(mappings.map((m) => m.to));

  return (
    <div className="rounded-[32px] border border-white/10 bg-black/20 p-5 backdrop-blur">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Mapping Studio</h2>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            Quell- und Zielfelder verbinden · {mappings.length} aktive Mappings
          </p>
        </div>
        <button
          type="button"
          disabled={!selectedSource || !selectedTarget}
          onClick={addMapping}
          className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm transition hover:border-[rgba(90,196,255,0.3)] hover:bg-[rgba(90,196,255,0.08)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Plus className="size-4" />
          Add Mapping
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_200px_1fr]">
        {/* Source fields */}
        <div className="rounded-2xl border border-white/10 bg-white/4 p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">
            Source
          </p>
          <div className="space-y-2">
            {sourceFields.map((f) => {
              const isMapped = mappedSources.has(f.name);
              const isSelected = selectedSource === f.name;
              return (
                <button
                  key={f.name}
                  type="button"
                  onClick={() => setSelectedSource(isSelected ? null : f.name)}
                  className={cn(
                    "flex w-full items-center justify-between rounded-[14px] border px-3 py-2 text-left text-sm transition",
                    isSelected
                      ? "border-[rgba(90,196,255,0.5)] bg-[rgba(90,196,255,0.1)] text-white"
                      : isMapped
                        ? "border-emerald-500/20 bg-emerald-500/5 text-white/60"
                        : "border-white/8 bg-white/3 text-white hover:border-white/20 hover:bg-white/6",
                  )}
                >
                  <span className="font-mono">{f.name}</span>
                  <TypeBadge type={f.type} />
                </button>
              );
            })}
          </div>
        </div>

        {/* Arrow connectors */}
        <div className="flex flex-col items-center justify-start gap-2 pt-9">
          {mappings.length === 0 ? (
            <div className="flex h-16 items-center justify-center text-xs text-[var(--muted-foreground)]">
              Kein Mapping
            </div>
          ) : (
            mappings.map((m, i) => (
              <div
                key={`${m.from}-${m.to}-${i}`}
                className="group flex w-full items-center justify-between gap-1 rounded-2xl border border-white/10 bg-white/4 px-3 py-2"
              >
                <span className="truncate text-[11px] font-mono text-[var(--muted-foreground)]">
                  {m.from}
                </span>
                <ArrowRight className="size-3 shrink-0 text-[var(--accent)]" />
                <span className="truncate text-[11px] font-mono text-[var(--muted-foreground)]">
                  {m.to}
                </span>
                <button
                  type="button"
                  onClick={() => removeMapping(i)}
                  className="ml-1 shrink-0 rounded-lg p-0.5 text-[var(--muted-foreground)] opacity-0 transition group-hover:opacity-100 hover:text-red-400"
                  aria-label="Remove"
                >
                  <Trash2 className="size-3" />
                </button>
              </div>
            ))
          )}
          {selectedSource && selectedTarget && (
            <div className="mt-2 flex w-full items-center justify-between gap-1 rounded-2xl border border-[rgba(90,196,255,0.3)] bg-[rgba(90,196,255,0.06)] px-3 py-2">
              <span className="truncate text-[11px] font-mono text-[var(--accent)]">
                {selectedSource}
              </span>
              <ArrowRight className="size-3 shrink-0 text-[var(--accent)]" />
              <span className="truncate text-[11px] font-mono text-[var(--accent)]">
                {selectedTarget}
              </span>
            </div>
          )}
        </div>

        {/* Target fields */}
        <div className="rounded-2xl border border-white/10 bg-white/4 p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">
            Target
          </p>
          <div className="space-y-2">
            {targetFields.map((f) => {
              const isMapped = mappedTargets.has(f.name);
              const isSelected = selectedTarget === f.name;
              return (
                <button
                  key={f.name}
                  type="button"
                  onClick={() => setSelectedTarget(isSelected ? null : f.name)}
                  className={cn(
                    "flex w-full items-center justify-between rounded-[14px] border px-3 py-2 text-left text-sm transition",
                    isSelected
                      ? "border-[rgba(90,196,255,0.5)] bg-[rgba(90,196,255,0.1)] text-white"
                      : isMapped
                        ? "border-emerald-500/20 bg-emerald-500/5 text-white/60"
                        : "border-white/8 bg-white/3 text-white hover:border-white/20 hover:bg-white/6",
                  )}
                >
                  <span className="font-mono">{f.name}</span>
                  <TypeBadge type={f.type} />
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
