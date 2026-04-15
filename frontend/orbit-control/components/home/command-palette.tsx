"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Command, Search, X } from "lucide-react";
import { useOrbitShellStore } from "@/lib/orbit-store";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Quick-action registry
// ---------------------------------------------------------------------------
type ActionItem = {
  id: string;
  label: string;
  category: "Navigation" | "Actions" | "System";
  description?: string;
  href?: string;
  action?: () => void;
  keywords: string[];
};

function buildItems(
  router: ReturnType<typeof useRouter>,
  closeModal: () => void,
): ActionItem[] {
  function nav(href: string) {
    return () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      router.push(href as any);
      closeModal();
    };
  }

  return [
    // Navigation
    { id: "nav-home", label: "Home", category: "Navigation", description: "Mission Control & schneller Einstieg", href: "/", action: nav("/"), keywords: ["home", "mission", "control"] },
    { id: "nav-workspace", label: "Workspace", category: "Navigation", description: "Streaming, Dateien und Ergebnisse", href: "/workspace", action: nav("/workspace"), keywords: ["workspace", "files", "streaming"] },
    { id: "nav-flows", label: "Flows", category: "Navigation", description: "No-Code und Low-Code Automatisierung", href: "/flows", action: nav("/flows"), keywords: ["flows", "automation", "workflow"] },
    { id: "nav-integrations", label: "Integrations", category: "Navigation", description: "Apps, Webhooks und Trigger", href: "/integrations", action: nav("/integrations"), keywords: ["integrations", "apps", "webhooks", "connectors"] },
    { id: "nav-control", label: "Control", category: "Navigation", description: "Governance, Health und Traces", href: "/control", action: nav("/control"), keywords: ["control", "governance", "health", "traces"] },
    { id: "nav-solutions", label: "Solutions", category: "Navigation", description: "Retail, Executive und Operations", href: "/solutions", action: nav("/solutions"), keywords: ["solutions", "retail", "executive", "operations"] },
    // Actions
    { id: "act-new-flow", label: "New Flow", category: "Actions", description: "Neuen Automation-Flow erstellen", href: "/flows/new", action: nav("/flows/new"), keywords: ["new", "flow", "create", "automation"] },
    { id: "act-new-connector", label: "New Connector", category: "Actions", description: "Integration verbinden", href: "/integrations/new", action: nav("/integrations/new"), keywords: ["new", "connector", "integration", "connect"] },
    { id: "act-run-analysis", label: "Run Analysis", category: "Actions", description: "Analyse starten", href: "/workspace?mode=analysis", action: nav("/workspace?mode=analysis"), keywords: ["run", "analysis", "analyse", "start"] },
    // System
    {
      id: "sys-reload",
      label: "Reload",
      category: "System",
      description: "Seite neu laden",
      keywords: ["reload", "refresh", "neu laden"],
      action: () => {
        window.location.reload();
      },
    },
    { id: "sys-settings", label: "Settings", category: "System", description: "Einstellungen öffnen", href: "/settings", action: nav("/settings"), keywords: ["settings", "einstellungen", "config"] },
  ];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function CommandPalette() {
  const open = useOrbitShellStore((state) => state.commandPaletteOpen);
  const setOpen = useOrbitShellStore((state) => state.setCommandPaletteOpen);
  const router = useRouter();

  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const close = () => {
    setOpen(false);
    setQuery("");
    setSelectedIndex(0);
  };

  const items = useMemo(() => buildItems(router, close), [router]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) =>
      [item.label, item.category, item.description ?? "", ...item.keywords]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [items, query]);

  // Reset selection when filter changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [filtered]);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Global keyboard shortcut Cmd+K / Ctrl+K
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen(!open);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, setOpen]);

  // Keyboard navigation inside palette
  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      close();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = filtered[selectedIndex];
      if (item?.action) item.action();
    }
  }

  if (!open) return null;

  // Group items by category preserving order
  const categories = ["Navigation", "Actions", "System"] as const;
  const grouped = categories
    .map((cat) => ({
      label: cat,
      items: filtered.filter((i) => i.category === cat),
    }))
    .filter((g) => g.items.length > 0);

  // Flat list for index tracking
  const flatItems = grouped.flatMap((g) => g.items);

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
        onClick={close}
        aria-hidden
      />

      {/* Modal */}
      <div
        className="fixed left-1/2 top-[20%] z-50 w-full max-w-xl -translate-x-1/2 rounded-[32px] border border-white/10 bg-black/80 p-1 shadow-2xl backdrop-blur"
        style={{ boxShadow: "0 0 60px rgba(90,196,255,0.12), 0 24px 60px rgba(0,0,0,0.7)" }}
        onKeyDown={handleKeyDown}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 rounded-[28px] border border-white/10 bg-white/5 px-4 py-3">
          <Search className="size-4 shrink-0 text-[var(--muted-foreground)]" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Suche nach Ziel, Bereich oder Aktion…"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--muted-foreground)]"
          />
          <div className="flex items-center gap-2">
            <kbd className="hidden rounded-lg border border-white/10 bg-white/5 px-2 py-0.5 text-xs text-[var(--muted-foreground)] sm:inline-flex">
              ESC
            </kbd>
            <button
              type="button"
              onClick={close}
              className="rounded-xl border border-white/10 bg-white/5 p-1.5 text-[var(--muted-foreground)] transition hover:bg-white/10 hover:text-white"
              aria-label="Schließen"
            >
              <X className="size-3.5" />
            </button>
          </div>
        </div>

        {/* Results */}
        <div className="mt-1 max-h-[360px] overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-[var(--muted-foreground)]">
              Keine Ergebnisse für „{query}"
            </div>
          ) : (
            grouped.map((group) => (
              <div key={group.label} className="mb-2">
                <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">
                  {group.label}
                </p>
                {group.items.map((item) => {
                  const flatIdx = flatItems.indexOf(item);
                  const isSelected = flatIdx === selectedIndex;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => item.action?.()}
                      onMouseEnter={() => setSelectedIndex(flatIdx)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-[18px] px-3 py-2.5 text-left text-sm transition",
                        isSelected
                          ? "bg-[rgba(90,196,255,0.12)] text-white"
                          : "text-white/80 hover:bg-white/5",
                      )}
                    >
                      <Command
                        className={cn(
                          "size-4 shrink-0",
                          isSelected
                            ? "text-[var(--accent)]"
                            : "text-[var(--muted-foreground)]",
                        )}
                      />
                      <div className="min-w-0 flex-1">
                        <span className="font-medium">{item.label}</span>
                        {item.description && (
                          <span className="ml-2 text-xs text-[var(--muted-foreground)]">
                            {item.description}
                          </span>
                        )}
                      </div>
                      {isSelected && (
                        <kbd className="rounded-lg border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] text-[var(--muted-foreground)]">
                          ↵
                        </kbd>
                      )}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer hint */}
        <div className="mt-1 flex items-center justify-between rounded-b-[28px] border-t border-white/5 px-4 py-2 text-xs text-[var(--muted-foreground)]">
          <span className="flex items-center gap-1.5">
            <kbd className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5">↑↓</kbd>
            Navigieren
          </span>
          <span className="flex items-center gap-1.5">
            <kbd className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5">↵</kbd>
            Öffnen
          </span>
          <span className="flex items-center gap-1.5">
            <kbd className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5">⌘K</kbd>
            Umschalten
          </span>
        </div>
      </div>
    </>
  );
}
