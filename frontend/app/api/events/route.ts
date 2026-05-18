import { NextResponse } from "next/server";
import { orbitFetch } from "@/lib/core/orbit-fetch";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = searchParams.get("limit") ?? "100";
  const { data, status } = await orbitFetch(`/ui/events?limit=${limit}`);
  if (status === 401 || status === 403) return NextResponse.json([], { status: 200 });
  return NextResponse.json(data, { status });
}
