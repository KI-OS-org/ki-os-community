import Link from "next/link";
import { orbitFetch } from "@/lib/core/orbit-fetch";
import { SmartInputBar } from "@/components/home/smart-input-bar";
import { WorkspaceShell } from "@/components/workspace/workspace-shell";
import { Badge } from "@/components/ui/badge";

export default async function WorkspacePage({
  searchParams,
}: {
  searchParams?: { goal?: string };
}) {
  const initialGoal = searchParams?.goal ?? "";
  const [wsResult, runsResult, filesResult] = await Promise.allSettled([
    orbitFetch("/ui/workspace"),
    orbitFetch("/ui/runs?limit=10"),
    orbitFetch("/ui/files"),
  ]);

  const workspace = wsResult.status === "fulfilled" ? wsResult.value.data : null;
  const runsRaw = runsResult.status === "fulfilled" ? runsResult.value.data : null;
  const filesRaw = filesResult.status === "fulfilled" ? filesResult.value.data : null;

  const runs: unknown[] = Array.isArray((runsRaw as { runs?: unknown[] })?.runs)
    ? (runsRaw as { runs: unknown[] }).runs
    : Array.isArray(runsRaw)
    ? (runsRaw as unknown[])
    : [];

  const files: unknown[] = Array.isArray((filesRaw as { files?: unknown[] })?.files)
    ? (filesRaw as { files: unknown[] }).files
    : Array.isArray(filesRaw)
    ? (filesRaw as unknown[])
    : [];

  const ws = workspace as { name?: string; role?: string } | null;

  return (
    <>
      <section className="rounded-[32px] border border-white/10 bg-black/20 p-5 backdrop-blur md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <Badge>Workspace</Badge>
            {ws?.name && <Badge className="text-cyan-200">{ws.name}</Badge>}
            {ws?.role && <Badge className="text-emerald-200">{ws.role}</Badge>}
          </div>
          <Link
            href="/workspace/whiteboard"
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[rgba(90,196,255,0.12)] border border-[rgba(90,196,255,0.25)] text-[#5ac4ff] text-sm font-medium hover:bg-[rgba(90,196,255,0.2)] transition-colors"
          >
            ✦ Whiteboard
          </Link>
        </div>
        <h2 className="mt-4 text-3xl font-semibold tracking-tight">Your Workspace</h2>
        <p className="mt-2 max-w-3xl text-sm text-[var(--muted-foreground)]">
          All your files, recent agent runs and memory hits — in one place.
        </p>
        <div className="mt-5">
          <SmartInputBar placeholder="e.g. Summarize all PDFs in this workspace…" defaultValue={initialGoal} />
        </div>
      </section>
      <WorkspaceShell workspace={workspace} runs={runs} files={files} />
    </>
  );
}
