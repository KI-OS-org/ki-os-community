import { NextResponse } from "next/server";
import { orbitFetch } from "@/lib/core/orbit-fetch";

// GET /api/campaigns — list all campaigns
export async function GET() {
  const { data, status } = await orbitFetch("/campaign");
  return NextResponse.json(data ?? { items: [] }, { status: status > 0 ? status : 200 });
}

// POST /api/campaigns — create campaign
export async function POST(req: Request) {
  const body = await req.json();
  const { data, status } = await orbitFetch("/campaign", {
    method: "POST",
    body: JSON.stringify(body),
  });
  return NextResponse.json(data, { status: status > 0 ? status : 200 });
}
