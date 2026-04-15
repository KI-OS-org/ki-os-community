"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--background)] p-6 text-[var(--foreground)]">
      <div className="max-w-lg rounded-[28px] border border-rose-500/20 bg-rose-500/5 p-6">
        <div className="flex items-center gap-3 text-rose-300">
          <AlertTriangle className="size-5" />
          <h2 className="text-xl font-semibold">Orbit Control konnte die Ansicht nicht laden</h2>
        </div>
        <p className="mt-4 text-sm text-[var(--muted-foreground)]">
          Foundation Error Boundary aktiv. Bitte erneut versuchen oder später mit den Runtime-Logs abgleichen.
        </p>
        <p className="mt-4 rounded-2xl bg-black/20 p-3 text-xs text-rose-100/80">{error.message}</p>
        <div className="mt-5">
          <Button onClick={reset}>Neu laden</Button>
        </div>
      </div>
    </div>
  );
}
