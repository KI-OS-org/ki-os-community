import { NextResponse } from "next/server";
import { orbitFetch } from "@/lib/core/orbit-fetch";

export async function GET() {
  const { data, status } = await orbitFetch("/ui/cockpit");
  if (status === 401 || status === 403) return NextResponse.json({}, { status: 200 });
  return NextResponse.json(data, { status });
}
