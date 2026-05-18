import { NextResponse } from "next/server";
import { orbitFetch } from "@/lib/core/orbit-fetch";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { data, status } = await orbitFetch(`/agents/${id}/toggle`, { method: "POST" });
  return NextResponse.json(data, { status: status > 0 ? status : 200 });
}
