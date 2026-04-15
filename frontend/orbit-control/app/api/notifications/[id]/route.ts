import { NextResponse } from "next/server";
import { orbitFetch } from "@/lib/core/orbit-fetch";

// PATCH /api/notifications/[id] — als gelesen markieren
export async function PATCH(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { data, status } = await orbitFetch(`/notifications/${id}/read`, { method: "PATCH", body: "{}" });
  return NextResponse.json(data ?? {}, { status: status > 0 ? status : 200 });
}

// DELETE /api/notifications/[id]
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { data, status } = await orbitFetch(`/notifications/${id}`, { method: "DELETE", body: "{}" });
  return NextResponse.json(data ?? {}, { status: status > 0 ? status : 200 });
}
