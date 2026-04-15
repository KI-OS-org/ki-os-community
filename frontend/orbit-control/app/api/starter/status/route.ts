import { NextResponse } from "next/server";
import { orbitFetch } from "@/lib/core/orbit-fetch";

export async function GET() {
  const { data, status } = await orbitFetch("/starter/status");
  return NextResponse.json(data ?? { active: false, lastDigest: null }, { status: status > 0 ? status : 200 });
}
