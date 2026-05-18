import { NextResponse } from "next/server";
import { orbitFetch } from "@/lib/core/orbit-fetch";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = searchParams.get("limit") ?? "100";
  const { data, status } = await orbitFetch(`/ui/audit?limit=${limit}`);
  if (status === 401 || status === 403) return NextResponse.json({ items: [], total: 0 }, { status: 200 });
  return NextResponse.json(data, { status });
}

export async function POST(request: Request) {
  const body = await request.json();
  const { data, status } = await orbitFetch("/ui/audit/write", {
    method: "POST",
    body: JSON.stringify(body),
  });
  return NextResponse.json(data, { status });
}
