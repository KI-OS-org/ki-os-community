/**
 * KI-OS Orbit Control — Memory Retrieve API Route
 * Copyright (c) Ingo Schaffer
 *
 * Zweck:
 * Liefert echte gespeicherte Memory-Hits aus der lokalen Runtime-Schicht und
 * filtert sie nach Query, Tenant und Workspace.
 *
 * Status:
 * LIVE
 */
import { NextRequest, NextResponse } from "next/server";
import { uiRuntimeService } from "@/lib/runtime/ui-runtime-service";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("query") || request.nextUrl.searchParams.get("q") || "";
  const tenant = request.nextUrl.searchParams.get("tenant") || "";
  const workspaceId = request.nextUrl.searchParams.get("workspaceId") || "";
  const hits = uiRuntimeService.retrieveMemory(query, tenant, workspaceId);
  return NextResponse.json({
    ok: true,
    mode: "LIVE",
    query,
    total: hits.length,
    hits
  });
}
