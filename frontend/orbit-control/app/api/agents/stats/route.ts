import { NextResponse } from "next/server";
import { orbitFetch } from "@/lib/core/orbit-fetch";

export async function GET() {
  const { data, status } = await orbitFetch("/agents/stats");
  return NextResponse.json(data ?? {}, { status: status > 0 ? status : 200 });
}
