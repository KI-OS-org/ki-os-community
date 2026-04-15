/**
 * KI-OS Orbit Control — Tenants API Proxy
 * Copyright (c) Ingo Schaffer
 *
 * GET  /api/tenants    → list tenants
 * POST /api/tenants    → create/upsert tenant
 */
import { NextRequest, NextResponse } from "next/server";
import { orbitFetch } from "@/lib/core/orbit-fetch";

export async function GET() {
  const { data, status } = await orbitFetch("/tenants");
  return NextResponse.json(data ?? { success: false, items: [] }, {
    status: status > 0 ? status : 200,
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { data, status } = await orbitFetch("/tenants", {
    method: "POST",
    body: JSON.stringify(body),
  });
  return NextResponse.json(data, { status: status > 0 ? status : 200 });
}
