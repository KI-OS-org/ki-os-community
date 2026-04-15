/**
 * KI-OS Orbit Control — Routing API Proxy
 * Copyright (c) Ingo Schaffer
 *
 * Proxies to backend routing endpoints:
 * GET /api/routing?path=scorecards|profiles|decisions
 */
import { NextRequest, NextResponse } from "next/server";
import { orbitFetch } from "@/lib/core/orbit-fetch";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const path = searchParams.get("path") ?? "scorecards";
  const limit = searchParams.get("limit") ?? "50";
  const { data, status } = await orbitFetch(`/routing/${path}?limit=${limit}`);
  return NextResponse.json(data ?? { success: false }, {
    status: status > 0 ? status : 200,
  });
}
