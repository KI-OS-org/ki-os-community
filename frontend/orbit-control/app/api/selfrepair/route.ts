import { orbitFetch } from "@/lib/core/orbit-fetch";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const params: Record<string, string> = {};
  searchParams.forEach((v, k) => { params[k] = v; });
  const { data, ok, status } = await orbitFetch("/selfrepair", { params });
  return NextResponse.json(data ?? {}, { status: ok ? 200 : status });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { data, ok, status } = await orbitFetch("/selfrepair/trigger", {
    method: "POST",
    body,
  });
  return NextResponse.json(data ?? {}, { status: ok ? 201 : status });
}
