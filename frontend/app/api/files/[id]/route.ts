/**
 * KI-OS Orbit Control — Files Single File API Proxy
 * Copyright (c) Ingo Schaffer
 *
 * GET    /api/files/:id  → get file detail
 * DELETE /api/files/:id  → delete file
 */
import { NextRequest, NextResponse } from "next/server";
import { orbitFetch } from "@/lib/core/orbit-fetch";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { data, status } = await orbitFetch(`/files/${id}`);
  return NextResponse.json(data ?? { success: false }, {
    status: status > 0 ? status : 200,
  });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { data, status } = await orbitFetch(`/files/${id}`, { method: "DELETE" });
  return NextResponse.json(data ?? { success: false }, {
    status: status > 0 ? status : 200,
  });
}
