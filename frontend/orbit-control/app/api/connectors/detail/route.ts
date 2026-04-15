import { NextResponse } from "next/server";
import { orbitFetch } from "@/lib/core/orbit-fetch";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id") ?? "";
  const { data, status } = await orbitFetch(`/connectors/${id}`);
  return NextResponse.json(data, { status });
}
