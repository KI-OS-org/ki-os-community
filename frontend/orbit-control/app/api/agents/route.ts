import { NextResponse } from "next/server";
import { orbitFetch } from "@/lib/core/orbit-fetch";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const params = new URLSearchParams();
  ["category","status","visibleTo","search"].forEach(k => {
    const v = searchParams.get(k);
    if (v) params.set(k, v);
  });
  const qs = params.toString();
  const { data, status } = await orbitFetch(`/agents${qs ? `?${qs}` : ""}`);
  return NextResponse.json(data ?? { agents: [], total: 0 }, { status: status > 0 ? status : 200 });
}

export async function POST(req: Request) {
  const body = await req.json();
  const { data, status } = await orbitFetch("/agents", { method: "POST", body: JSON.stringify(body) });
  return NextResponse.json(data, { status: status > 0 ? status : 201 });
}
