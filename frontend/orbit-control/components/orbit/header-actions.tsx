"use client";

import Link from "next/link";
import { Bell, Command, MoonStar, Search, ShieldCheck, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useOrbitShellStore } from "@/lib/orbit-store";

const btnClass =
  "inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm transition hover:border-[rgba(90,196,255,0.3)] hover:bg-[rgba(90,196,255,0.08)]";

export function HeaderActions({ notificationCount }: { notificationCount: number }) {
  const setCommandPaletteOpen = useOrbitShellStore(
    (state) => state.setCommandPaletteOpen,
  );
  const setSearchModalOpen = useOrbitShellStore(
    (state) => state.setSearchModalOpen,
  );
  const { theme, setTheme } = useTheme();

  function toggleTheme() {
    setTheme(theme === "dark" ? "light" : "dark");
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        className={btnClass}
        onClick={() => setSearchModalOpen(true)}
      >
        <Search className="size-4" />
        Search
      </button>

      <button
        type="button"
        className={btnClass}
        onClick={() => setCommandPaletteOpen(true)}
      >
        <Command className="size-4" />
        Command
      </button>

      <Link href="/trust" className={btnClass}>
        <ShieldCheck className="size-4" />
        Trust
      </Link>

      <Link href="/notifications" className={`${btnClass} relative`} aria-label="Notifications">
        <Bell className="size-4" />
        {notificationCount > 0 && (
          <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-[var(--accent)] text-[10px] font-semibold text-black">
            {notificationCount > 99 ? "99+" : notificationCount}
          </span>
        )}
      </Link>

      <button
        type="button"
        className={btnClass}
        onClick={toggleTheme}
        aria-label="Toggle theme"
      >
        {theme === "dark" ? <Sun className="size-4" /> : <MoonStar className="size-4" />}
      </button>

    </div>
  );
}
