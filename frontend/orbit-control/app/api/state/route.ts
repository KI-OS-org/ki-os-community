import { NextResponse } from "next/server";
import { orbitFetch } from "@/lib/core/orbit-fetch";

// GET /api/state?section=fabric|export|backends
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const section = searchParams.get("section") ?? "fabric";

  const endpointMap: Record<string, string> = {
    fabric:   "/state/fabric",
    export:   "/state/export",
    backends: "/state/backends/health",
  };

  const endpoint = endpointMap[section] ?? "/state/fabric";
  const { data, status } = await orbitFetch(endpoint);
  return NextResponse.json(data ?? {}, { status: status > 0 ? status : 200 });
}

// POST /api/state?action=import
export async function POST(req: Request) {
  const body = await req.json();
  const { data, status } = await orbitFetch("/state/import", {
    method: "POST",
    body: JSON.stringify(body),
  });
  return NextResponse.json(data, { status: status > 0 ? status : 200 });
}
