import { NextResponse } from "next/server";
import { orbitFetch } from "@/lib/core/orbit-fetch";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit   = searchParams.get("limit")   ?? "50";
  const agentId = searchParams.get("agentId") ?? "";

  // Fetch more runs when filtering so we get enough after client-side filter
  const fetchLimit = agentId ? Math.max(Number(limit), 200) : Number(limit);
  const { data, status } = await orbitFetch(`/ui/runs?limit=${fetchLimit}`);
  if (status === 401 || status === 403) return NextResponse.json([], { status: 200 });

  // Apply agentId filter server-side in the proxy
  if (agentId) {
    const items: unknown[] = Array.isArray((data as { items?: unknown[] })?.items)
      ? (data as { items: unknown[] }).items
      : Array.isArray(data) ? (data as unknown[]) : [];
    const filtered = items.filter(
      (r): r is Record<string, unknown> =>
        typeof r === "object" && r !== null &&
        (r as Record<string, unknown>).agentId === agentId,
    );
    return NextResponse.json(
      { success: true, items: filtered },
      { status: status > 0 ? status : 200 },
    );
  }

  return NextResponse.json(data, { status: status > 0 ? status : 200 });
}
