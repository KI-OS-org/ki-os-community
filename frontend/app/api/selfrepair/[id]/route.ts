import { orbitFetch } from "@/lib/core/orbit-fetch";
import { NextRequest, NextResponse } from "next/server";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { data, ok, status } = await orbitFetch(`/selfrepair/${id}`);
  return NextResponse.json(data ?? {}, { status: ok ? 200 : status });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const { data, ok, status } = await orbitFetch(`/selfrepair/${id}`, { method: "PUT", body });
  return NextResponse.json(data ?? {}, { status: ok ? 200 : status });
}
