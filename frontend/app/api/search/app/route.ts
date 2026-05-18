import { NextResponse } from "next/server";
import { orbitFetch } from "@/lib/core/orbit-fetch";

type SearchItem = Record<string, unknown> & { type: string; title?: string; name?: string; description?: string };

function matches(item: unknown, q: string): boolean {
  if (!q) return true;
  return JSON.stringify(item).toLowerCase().includes(q);
}

function extractItems(data: unknown, fallbackKey = "items"): Record<string, unknown>[] {
  if (!data || typeof data !== "object") return [];
  const d = data as Record<string, unknown>;
  if (Array.isArray(d[fallbackKey])) return d[fallbackKey] as Record<string, unknown>[];
  if (Array.isArray(d.data))         return d.data as Record<string, unknown>[];
  if (Array.isArray(data))           return data as Record<string, unknown>[];
  return [];
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q        = (searchParams.get("q") ?? "").toLowerCase().trim();
  const category = searchParams.get("category") ?? "all";

  const results: SearchItem[] = [];
  const want = (cat: string) => category === "all" || category === cat;

  // Parallel fetch aller relevanten Quellen
  const [runs, connectors, agents, flows, files, campaigns, memory] = await Promise.allSettled([
    want("runs")         ? orbitFetch("/ui/runs?limit=100").then(r => r.data)         : Promise.resolve(null),
    want("integrations") ? orbitFetch("/connectors").then(r => r.data)                : Promise.resolve(null),
    want("agents")       ? orbitFetch("/agents?limit=100").then(r => r.data)          : Promise.resolve(null),
    want("flows")        ? orbitFetch("/dag/registry").then(r => r.data)              : Promise.resolve(null),
    want("files")        ? orbitFetch("/files?limit=100").then(r => r.data)           : Promise.resolve(null),
    want("campaigns")    ? orbitFetch("/campaign").then(r => r.data)                  : Promise.resolve(null),
    (want("memory") && q) ? orbitFetch("/memory/retrieve", { method: "POST", body: JSON.stringify({ query: q, limit: 10 }) }).then(r => r.data) : Promise.resolve(null),
  ]);

  const push = (data: PromiseSettledResult<unknown>, type: string, limit = 10) => {
    if (data.status !== "fulfilled" || !data.value) return;
    extractItems(data.value)
      .filter(i => matches(i, q))
      .slice(0, limit)
      .forEach(i => results.push({ ...i, type }));
  };

  push(runs,        "run",        10);
  push(connectors,  "connector",  10);
  push(agents,      "agent",      10);
  push(flows,       "flow",       10);
  push(files,       "file",       10);
  push(campaigns,   "campaign",   10);

  // Memory gibt anderes Format zurück
  if (memory.status === "fulfilled" && memory.value) {
    const memData = memory.value as Record<string, unknown>;
    const memItems = Array.isArray(memData.results) ? memData.results : Array.isArray(memData.items) ? memData.items : [];
    (memItems as Record<string, unknown>[]).slice(0, 5).forEach(i =>
      results.push({ ...i, type: "memory", title: String((i as Record<string,unknown>).content ?? "").slice(0, 80) })
    );
  }

  return NextResponse.json({ ok: true, items: results, total: results.length, query: q, category });
}
