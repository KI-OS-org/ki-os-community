/**
 * KI-OS Orbit Control — Files Upload API Proxy
 * Copyright (c) Ingo Schaffer
 *
 * POST /api/files/upload → proxy to backend /files/upload
 * Accepts JSON body with file metadata (name, content, mimeType, size, tags)
 */
import { NextRequest, NextResponse } from "next/server";
import { orbitFetch } from "@/lib/core/orbit-fetch";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { data, status } = await orbitFetch("/files/upload", {
    method: "POST",
    body: JSON.stringify(body),
  });
  return NextResponse.json(data ?? { success: false }, {
    status: status > 0 ? status : 200,
  });
}
