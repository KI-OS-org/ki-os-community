import { NextResponse } from "next/server";
import { orbitFetch } from "@/lib/core/orbit-fetch";

export async function GET() {
  const { data, status } = await orbitFetch("/ui/governance/approvals");
  if (status === 401 || status === 403) return NextResponse.json({ approvals: [] }, { status: 200 });
  return NextResponse.json(data, { status });
}
