"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { orbitRuntimeConfig } from "@/lib/config";

export function TenantSwitcher({ currentTenant }: { currentTenant: string }) {
  const router = useRouter();
  const [tenant, setTenant] = useState(currentTenant);
  const [isPending, startTransition] = useTransition();

  async function persist(nextTenant: string) {
    await fetch("/api/tenant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tenant: nextTenant }),
    });
    startTransition(() => router.refresh());
  }

  return (
    <label className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm">
      <span className="text-[var(--muted-foreground)]">Tenant</span>
      <select
        className="bg-transparent outline-none"
        disabled={isPending}
        value={tenant}
        onChange={(event) => {
          const nextTenant = event.target.value;
          setTenant(nextTenant);
          void persist(nextTenant);
        }}
      >
        {orbitRuntimeConfig.tenants.map((item) => (
          <option key={item} value={item} className="bg-[#0e1526]">
            {item}
          </option>
        ))}
      </select>
    </label>
  );
}
