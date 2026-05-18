/**
 * KI-OS Orbit Control — Workspace Context API Proxy
 * Copyright (c) Ingo Schaffer
 *
 * GET /api/workspace/context → backend /workspace/context
 */
import { NextResponse } from "next/server";
import { orbitFetch } from "@/lib/core/orbit-fetch";

export async function GET() {
  const { data, status } = await orbitFetch("/workspace/context");
  return NextResponse.json(data ?? { success: false }, {
    status: status > 0 ? status : 200,
  });
}
