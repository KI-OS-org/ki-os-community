"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ChevronRight, ChevronDown, Zap } from "lucide-react";
import { navigationSections } from "@/lib/navigation";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// System status footer (pings health endpoint every 30 s)
// ---------------------------------------------------------------------------
function SidebarFooter() {
  const [status, setStatus] = useState<"online" | "offline" | "checking">("checking");
  const [now, setNow] = useState<string>("");

  useEffect(() => {
    function formatDate() {
      return new Date().toLocaleString("de-DE", {
        day: "2-digit",
        month: "2-digit",
        year: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
    }
    setNow(formatDate());

    async function ping() {
      try {
        const res = await fetch("/api/control-plane/health", { cache: "no-store" });
        setStatus(res.ok ? "online" : "offline");
      } catch {
        setStatus("offline");
      }
    }

    ping();
    const healthInterval = setInterval(ping, 30_000);
    const clockInterval = setInterval(() => setNow(formatDate()), 10_000);

    return () => {
      clearInterval(healthInterval);
      clearInterval(clockInterval);
    };
  }, []);

  const dotColor =
    status === "online"
      ? "bg-emerald-400"
      : status === "offline"
        ? "bg-red-400"
        : "bg-yellow-400";

  return (
    <div className="mt-auto rounded-[20px] border border-white/10 bg-black/20 px-3 py-2.5 space-y-1.5">
      {/* Status + Zeit */}
      <Link
        href="/control"
        className="flex items-center justify-between gap-2 transition hover:text-white"
      >
        <div className="flex items-center gap-2">
          <span className={cn("inline-block size-2 shrink-0 rounded-full", dotColor)} />
          <span className="text-sm font-medium">
            {status === "online" ? "System online" : status === "offline" ? "System offline" : "Verbinde…"}
          </span>
        </div>
        {now && (
          <span className="text-[10px] text-[var(--muted-foreground)]">{now}</span>
        )}
      </Link>
      {/* Version + Copyright */}
      <div className="border-t border-white/8 pt-2">
        <div className="text-[10px] font-mono text-[var(--accent)] tracking-wide flex items-center gap-0.5">
          <Image src="/ki-os-logo.png" alt="KI" width={20} height={20} className="w-auto" />
          <span>OS Ver. 1.0.2  ✦</span>
        </div>
        <p className="text-[10px] text-[var(--muted-foreground)] mt-0.5">
          &copy; 2026 by Ingo Schaffer
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Simulations section (external-only links not in primary nav)
// ---------------------------------------------------------------------------
const simulations = [
  {
    label: "One Voice",
    href: "/simulations/agentmesh/index.html",
    icon: Zap,
    description: "One Voice Prinzip · KIMBA · AgentMesh",
    external: true,
  },
  {
    label: "Kimba Moment",
    href: "/simulations/kimba-moment/index.html",
    icon: Zap,
    description: "KIMBA · KI-OS Simulation",
    external: true,
  },
] as const;

// ---------------------------------------------------------------------------
// Sidebar
// ---------------------------------------------------------------------------
export function OrbitSidebar() {
  const pathname = usePathname();

  const [openSections, setOpenSections] = useState<Set<string>>(
    () => new Set(navigationSections.map((s) => s.label))
  );

  function toggleSection(label: string) {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  }

  return (
    <aside className="hidden h-[calc(100vh-2rem)] w-[296px] shrink-0 rounded-[32px] border border-white/10 bg-black/30 p-4 backdrop-blur xl:flex xl:flex-col">
      {/* Logo section */}
      <div className="mb-3 flex items-center justify-between gap-3 rounded-[24px] border border-white/10 bg-white/4 px-4 py-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.24em] text-[var(--muted-foreground)]">
            Orbit Control
          </p>
          <div className="mt-0.5 flex items-center gap-0.5 text-xl font-bold tracking-tight" style={{ textShadow: "0 0 20px rgba(90,196,255,0.5)" }}>
            <Image src="/ki-os-logo.png" alt="KI" width={32} height={32} className="w-auto" />
            <span>OS</span>
          </div>
          <p className="text-xs text-[var(--muted-foreground)]">
            No-Code · Low-Code · Full Control
          </p>
        </div>
      </div>

      {/* Scrollable nav area */}
      <div className="flex-1 overflow-y-auto space-y-1 pr-0.5">
        {/* Primary navigation — grouped sections with accordion */}
        <nav className="space-y-0.5">
          {navigationSections.map((section) => {
            const isOpen = openSections.has(section.label);
            const hasActiveItem = section.items.some((item) =>
              item.href === "/" ? pathname === "/" : pathname === item.href || pathname.startsWith(item.href + "/")
            );

            return (
              <div key={section.label} className={section.label ? "pt-2" : ""}>
                {/* Section header — clickable for accordion */}
                {section.label && (
                  <button
                    onClick={() => toggleSection(section.label)}
                    className="mb-1 flex w-full items-center justify-between px-4 py-0.5 group"
                  >
                    <span className={cn(
                      "text-[10px] font-semibold uppercase tracking-widest transition-colors",
                      hasActiveItem ? "text-[var(--accent)]" : "text-[var(--muted-foreground)] group-hover:text-white/60"
                    )}>
                      {section.label}
                    </span>
                    <ChevronDown className={cn(
                      "size-3 transition-all duration-200 text-[var(--muted-foreground)]",
                      isOpen ? "rotate-0" : "-rotate-90"
                    )} />
                  </button>
                )}

                {/* Accordion body */}
                <div className={cn(
                  "grid transition-all duration-200 ease-in-out",
                  isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                )}>
                  <div className="overflow-hidden space-y-0.5">
                    {section.items.map((item) => {
                      const Icon = item.icon;
                      const active =
                        item.href === "/"
                          ? pathname === "/"
                          : pathname === item.href || pathname.startsWith(item.href + "/");

                      return (
                        <Link
                          key={item.label}
                          href={item.href}
                          className={cn(
                            "group flex items-center gap-2.5 rounded-[20px] border px-3 py-2 transition-all",
                            active
                              ? "border-l-2 border-l-[var(--accent)] border-white/10 bg-white/8 nav-item-active"
                              : "border-transparent hover:border-white/8 hover:bg-white/4",
                          )}
                        >
                          <div className={cn(
                            "rounded-xl p-1.5 transition-colors",
                            active
                              ? "bg-[rgba(90,196,255,0.12)] text-[var(--accent)]"
                              : "bg-white/6 text-[var(--muted-foreground)] group-hover:text-white",
                          )}>
                            <Icon className="size-3.5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-white">{item.label}</p>
                            <p className="truncate text-[11px] text-[var(--muted-foreground)]">
                              {item.description}
                            </p>
                          </div>
                          <ChevronRight className={cn(
                            "size-3.5 transition-colors",
                            active ? "text-[var(--accent)]" : "text-[var(--muted-foreground)]",
                          )} />
                        </Link>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </nav>

        {/* Simulations section */}
        <div className="pt-2">
          <p className="mb-1 px-4 text-[10px] font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">
            Simulationen
          </p>
          {simulations.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            const inner = (
              <>
                <div className={cn(
                  "rounded-xl p-1.5 transition-colors",
                  active
                    ? "bg-[rgba(90,196,255,0.12)] text-[var(--accent)]"
                    : "bg-white/6 text-[var(--muted-foreground)] group-hover:text-white",
                )}>
                  <Icon className="size-3.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-white">{item.label}</p>
                  <p className="truncate text-[11px] text-[var(--muted-foreground)]">
                    {item.description}
                  </p>
                </div>
                <ChevronRight className={cn(
                  "size-3.5 transition-colors",
                  active ? "text-[var(--accent)]" : "text-[var(--muted-foreground)]",
                )} />
              </>
            );
            return item.external ? (
              <a
                key={item.label}
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center gap-2.5 rounded-[20px] border border-transparent px-3 py-2 transition-all hover:border-white/8 hover:bg-white/4"
              >
                {inner}
              </a>
            ) : (
              <Link
                key={item.label}
                href={item.href}
                className={cn(
                  "group flex items-center gap-2.5 rounded-[20px] border px-3 py-2 transition-all",
                  active
                    ? "border-l-2 border-l-[var(--accent)] border-white/10 bg-white/8"
                    : "border-transparent hover:border-white/8 hover:bg-white/4",
                )}
              >
                {inner}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Footer */}
      <SidebarFooter />
    </aside>
  );
}
