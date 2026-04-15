"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Pause, Play, Trash2 } from "lucide-react";

export function AgentDetailActions({ agentId, status }: { agentId: string; status: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function toggle() {
    startTransition(async () => {
      await fetch(`/api/agents/${agentId}/toggle`, { method: "POST" });
      router.refresh();
    });
  }

  function remove() {
    if (!confirm("Agent wirklich löschen?")) return;
    startTransition(async () => {
      await fetch(`/api/agents/${agentId}`, { method: "DELETE" });
      router.push("/agents");
    });
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        className="inline-flex items-center gap-2 rounded-[18px] border border-white/10 bg-white/5 px-4 py-2 text-sm transition hover:bg-white/10 disabled:opacity-50"
      >
        {status === "active"
          ? <><Pause className="size-4 text-yellow-400" /> Pausieren</>
          : <><Play  className="size-4 text-emerald-400" /> Aktivieren</>}
      </button>
      <button
        type="button"
        onClick={remove}
        disabled={pending}
        className="inline-flex items-center gap-2 rounded-[18px] border border-red-500/20 bg-red-500/8 px-4 py-2 text-sm text-red-400 transition hover:bg-red-500/15 disabled:opacity-50"
      >
        <Trash2 className="size-4" /> Löschen
      </button>
    </div>
  );
}
