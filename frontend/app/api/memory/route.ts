import { NextResponse } from "next/server";
import { orbitFetch }  from "@/lib/core/orbit-fetch";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId") ?? "demo";
  const limit  = searchParams.get("limit")  ?? "100";
  const q      = searchParams.get("q")      ?? "";
  const url    = q
    ? `/memory?userId=${userId}&limit=${limit}&q=${encodeURIComponent(q)}&semantic=true`
    : `/memory?userId=${userId}&limit=${limit}`;
  const { data, status } = await orbitFetch(url);
  return NextResponse.json(data, { status });
}

export async function POST(request: Request) {
  const body = await request.json();
  const { data, status } = await orbitFetch("/memory", {
    method: "POST",
    body: JSON.stringify(body),
  });
  return NextResponse.json(data, { status });
}
