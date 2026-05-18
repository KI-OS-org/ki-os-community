/**
 * KI-OS Orbit Control — AgentMesh Runs API Proxy
 * Copyright (c) Ingo Schaffer
 *
 * Proxies to backend /agentmesh/runs
 * GET  → list runs
 * POST → start new run
 */
import { NextRequest, NextResponse } from "next/server";
import { orbitFetch } from "@/lib/core/orbit-fetch";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const params = new URLSearchParams();
  ["status", "limit", "userId", "tenantId"].forEach((k) => {
    const v = searchParams.get(k);
    if (v) params.set(k, v);
  });
  const qs = params.toString();
  const { data, status } = await orbitFetch(`/agentmesh/runs${qs ? `?${qs}` : ""}`);
  return NextResponse.json(data ?? { success: false, runs: [], total: 0 }, {
    status: status > 0 ? status : 200,
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { data, status } = await orbitFetch("/agentmesh/runs", {
    method: "POST",
    body: JSON.stringify(body),
  });
  return NextResponse.json(data, { status: status > 0 ? status : 202 });
}
