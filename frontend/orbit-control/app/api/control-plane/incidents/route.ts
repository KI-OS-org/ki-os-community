import { NextResponse } from "next/server";
import { orbitFetch } from "@/lib/core/orbit-fetch";

export async function GET() {
  const { data, status } = await orbitFetch("/ui/incidents");
  if (status === 401 || status === 403) return NextResponse.json({ incidents: [], total: 0 }, { status: 200 });
  return NextResponse.json(data, { status });
}
