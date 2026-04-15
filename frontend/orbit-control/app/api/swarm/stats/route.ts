/**
 * KI-OS Orbit Control — Swarm Memory Stats API Route
 * Proxied vom Next.js Frontend an das KI-OS Backend (/swarm/stats).
 */
import { NextResponse } from "next/server";
import { orbitFetch } from "@/lib/core/orbit-fetch";

export async function GET() {
  const { data, status } = await orbitFetch<Record<string, unknown>>("/swarm/stats");
  const httpStatus = status > 0 ? status : 503;

  return NextResponse.json(data ?? { total: 0 }, { status: httpStatus });
}
