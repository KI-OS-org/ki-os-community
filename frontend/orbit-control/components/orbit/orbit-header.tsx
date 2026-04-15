import Link from "next/link";
import Image from "next/image";

import { appConfig } from "@/lib/config";
import { Badge } from "@/components/ui/badge";
import { AuthStatus } from "@/components/auth/auth-status";
import { HeaderActions } from "./header-actions";

async function fetchBackendStatus(): Promise<boolean> {
  try {
    const res = await fetch(
      `${appConfig.apiUrl}/api/control-plane/health`,
      { cache: "no-store" },
    );
    return res.ok;
  } catch {
    return false;
  }
}

async function fetchNotificationCount(): Promise<number> {
  try {
    const res = await fetch(
      `${appConfig.apiUrl}/api/notifications/feed`,
      { cache: "no-store" },
    );
    if (!res.ok) return 0;
    const data = await res.json();
    if (Array.isArray(data)) return data.length;
    if (typeof data?.count === "number") return data.count;
    if (Array.isArray(data?.items)) return data.items.length;
    return 0;
  } catch {
    return 0;
  }
}

export async function OrbitHeader() {
  const [backendOnline, notificationCount] = await Promise.all([
    fetchBackendStatus(),
    fetchNotificationCount(),
  ]);

  return (
    <header className="flex flex-col gap-4 rounded-[32px] border border-white/10 bg-black/20 p-5 backdrop-blur xl:flex-row xl:items-center xl:justify-between">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <Badge>{appConfig.defaultTenant}</Badge>
          <Badge>{appConfig.defaultRole}</Badge>
          <Badge className="border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
            Live
          </Badge>
        </div>
        <div className="mt-3 flex items-center gap-1 text-3xl font-semibold tracking-tight">
          <Image src="/ki-os-logo.png" alt="KI" width={48} height={48} className="w-auto" />
          <span>OS Orbit Control</span>
        </div>
        <Link
          href="/control"
          className="mt-2 inline-flex max-w-3xl items-center gap-2 text-sm text-[var(--muted-foreground)] transition hover:text-white"
        >
          <span className={`inline-block size-2 rounded-full ${backendOnline ? "bg-emerald-400" : "bg-red-400"}`} />
          {backendOnline ? "Backend verbunden" : "Backend offline"}
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <AuthStatus />
        <HeaderActions notificationCount={notificationCount} />
      </div>
    </header>
  );
}
