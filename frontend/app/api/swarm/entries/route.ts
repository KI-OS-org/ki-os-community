/**
 * KI-OS Orbit Control — Swarm Memory Entries API Route
 * Proxied vom Next.js Frontend an das KI-OS Backend (/swarm/entries).
 */
import { NextRequest, NextResponse } from "next/server";
import { orbitFetch } from "@/lib/core/orbit-fetch";

export async function GET(request: NextRequest) {
  const limit = request.nextUrl.searchParams.get("limit") ?? "100";
  const type  = request.nextUrl.searchParams.get("type");

  const qs = new URLSearchParams({ limit });
  if (type) qs.set("type", type);

  const { data, status } = await orbitFetch<unknown[]>(`/swarm/entries?${qs.toString()}`);
  const httpStatus = status > 0 ? status : 503;

  return NextResponse.json(data ?? [], { status: httpStatus });
}
