import { NextResponse } from "next/server";
import { orbitFetch } from "@/lib/core/orbit-fetch";

export async function POST(request: Request) {
  const body = await request.json();
  const { data, status } = await orbitFetch("/packs/install", { method: "POST", body: JSON.stringify(body) });
  return NextResponse.json(data, { status });
}
