import { NextResponse } from "next/server";
import { orbitFetch } from "@/lib/core/orbit-fetch";

// GET /api/economic?section=profiles|scorecards|decisions
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const section = searchParams.get("section") ?? "profiles";

  const endpointMap: Record<string, string> = {
    profiles:   "/economic/profiles",
    scorecards: "/economic/scorecards",
    decisions:  "/economic/decisions",
  };

  const endpoint = endpointMap[section] ?? "/economic/profiles";
  const { data, status } = await orbitFetch(endpoint);
  return NextResponse.json(data ?? [], { status: status > 0 ? status : 200 });
}

// POST /api/economic — evaluate
export async function POST(req: Request) {
  const body = await req.json();
  const { data, status } = await orbitFetch("/economic/evaluate", {
    method: "POST",
    body: JSON.stringify(body),
  });
  return NextResponse.json(data, { status: status > 0 ? status : 200 });
}
