import { orbitFetch } from "@/lib/core/orbit-fetch";
import { NextRequest, NextResponse } from "next/server";

export async function POST(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { data, ok, status } = await orbitFetch(`/selfrepair/${id}/analyze`, { method: "POST", body: {} });
  return NextResponse.json(data ?? {}, { status: ok ? 202 : status });
}
