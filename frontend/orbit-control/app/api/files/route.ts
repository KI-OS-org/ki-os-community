/**
 * KI-OS Orbit Control — Files API Route
 * Copyright (c) Ingo Schaffer
 *
 * Zweck:
 * Liefert echte gespeicherte File-Einträge aus der lokalen Runtime-Schicht,
 * statt statische Demo-Dateien zu importieren.
 *
 * Status:
 * LIVE
 */
import { NextRequest, NextResponse } from "next/server";
import { uiRuntimeService } from "@/lib/runtime/ui-runtime-service";

export async function GET(request: NextRequest) {
  const tenant = request.nextUrl.searchParams.get("tenant") || "";
  const files = uiRuntimeService.listFiles(tenant);
  return NextResponse.json({
    ok: true,
    mode: "LIVE",
    files,
    total: files.length
  });
}
