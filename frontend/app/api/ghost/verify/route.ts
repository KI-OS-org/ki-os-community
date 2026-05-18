/**
 * KI-OS Orbit Control — Ghost Vision Verify API Route
 * Proxied vom Next.js Frontend an das KI-OS Backend (POST /ghost/verify).
 * Ghost Control Vision Phase 1: Screenshot-Verifikation.
 */
import { NextRequest, NextResponse } from "next/server";
import { orbitFetch } from "@/lib/core/orbit-fetch";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { data, status } = await orbitFetch("/ghost/verify", {
    method:    "POST",
    body:      JSON.stringify(body),
    timeoutMs: 30000, // Vision LLM braucht mehr Zeit
  });
  const httpStatus = status > 0 ? status : 503;
  return NextResponse.json(data ?? { success: false, error: "Ghost Vision backend unavailable" }, { status: httpStatus });
}
