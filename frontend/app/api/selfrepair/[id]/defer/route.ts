import { orbitFetch } from "@/lib/core/orbit-fetch";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const { data, ok, status } = await orbitFetch(`/selfrepair/${id}/defer`, { method: "POST", body });
  return NextResponse.json(data ?? {}, { status: ok ? 200 : status });
}
