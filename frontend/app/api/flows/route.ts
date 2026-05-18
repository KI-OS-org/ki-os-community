import { NextResponse } from "next/server";
import { orbitFetch } from "@/lib/core/orbit-fetch";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  const path = id ? `/dag/${id}` : "/dag";
  const { data, status } = await orbitFetch(path);
  return NextResponse.json(data, { status });
}

export async function POST(request: Request) {
  const body = await request.json();
  const { data, status } = await orbitFetch("/dag", { method: "POST", body: JSON.stringify(body) });
  return NextResponse.json(data, { status });
}
