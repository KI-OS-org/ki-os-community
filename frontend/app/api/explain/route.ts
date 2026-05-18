import { NextResponse } from "next/server";
import { orbitFetch } from "@/lib/core/orbit-fetch";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const runId = searchParams.get("runId");
  const path = runId ? `/ui/policy/explain?runId=${runId}` : "/ui/policy/explain";
  const { data, status } = await orbitFetch(path);
  return NextResponse.json(data, { status });
}
