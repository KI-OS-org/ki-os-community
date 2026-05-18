import { orbitFetch } from "@/lib/core/orbit-fetch";
import { NextResponse } from "next/server";

export async function GET() {
  const { data, ok, status } = await orbitFetch("/selfrepair/stats");
  return NextResponse.json(data ?? {}, { status: ok ? 200 : status });
}
