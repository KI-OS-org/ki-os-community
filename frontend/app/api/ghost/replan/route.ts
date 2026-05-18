/**
 * KI-OS Orbit Control — Ghost Control Re-Plan API Route
 * Ghost Control Vision Phase 2: Re-Planning on Vision-Fail.
 * Proxied vom Next.js Frontend an das KI-OS Backend (POST /ghost/replan).
 */
import { NextRequest, NextResponse } from "next/server";
import { orbitFetch } from "@/lib/core/orbit-fetch";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { data, status } = await orbitFetch("/ghost/replan", {
    method:    "POST",
    body:      JSON.stringify(body),
    timeoutMs: 25000,
  });
  const httpStatus = status > 0 ? status : 503;
  return NextResponse.json(data ?? { success: false, error: "Ghost Re-Plan backend unavailable" }, { status: httpStatus });
}
