import { NextResponse } from "next/server";
import { orbitFetch } from "@/lib/core/orbit-fetch";

// GET /api/mcp?section=capabilities|health|manifest
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const section = searchParams.get("section") ?? "capabilities";

  const endpointMap: Record<string, string> = {
    capabilities: "/mcp/capabilities",
    health:       "/mcp/health",
    manifest:     "/mcp/manifest",
  };

  const endpoint = endpointMap[section] ?? "/mcp/capabilities";
  const { data, status } = await orbitFetch(endpoint);
  return NextResponse.json(data ?? {}, { status: status > 0 ? status : 200 });
}

// POST /api/mcp  — invoke a capability
export async function POST(req: Request) {
  const body = await req.json();
  const { data, status } = await orbitFetch("/mcp/invoke", {
    method: "POST",
    body: JSON.stringify(body),
  });
  return NextResponse.json(data, { status: status > 0 ? status : 200 });
}
