import { NextResponse } from "next/server";
import { orbitFetch } from "@/lib/core/orbit-fetch";

// GET /api/campaigns/[id]
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { data, status } = await orbitFetch(`/campaign/${id}`);
  return NextResponse.json(data ?? {}, { status: status > 0 ? status : 200 });
}

// DELETE /api/campaigns/[id]
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { data, status } = await orbitFetch(`/campaign/${id}`, { method: "DELETE" });
  return NextResponse.json(data, { status: status > 0 ? status : 200 });
}
