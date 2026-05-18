import { NextResponse } from "next/server";
import { orbitFetch } from "@/lib/core/orbit-fetch";

// POST /api/privacy?action=analyze|mask|demask
export async function POST(req: Request) {
  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action") ?? "analyze";
  const body = await req.json();

  const endpointMap: Record<string, string> = {
    analyze: "/privacy/analyze",
    mask:    "/privacy/mask",
    demask:  "/privacy/demask",
  };

  if (!endpointMap[action]) {
    return NextResponse.json(
      { success: false, error: `Unknown action: ${action}. Must be one of: analyze, mask, demask` },
      { status: 400 }
    );
  }

  const endpoint = endpointMap[action];
  const { data, status } = await orbitFetch(endpoint, {
    method: "POST",
    body: JSON.stringify(body),
  });
  return NextResponse.json(data, { status: status > 0 ? status : 200 });
}
