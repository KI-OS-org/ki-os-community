import { NextResponse } from "next/server";
import { orbitFetch } from "@/lib/core/orbit-fetch";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tenantId = searchParams.get("tenantId") ?? "";
  const { data, status } = await orbitFetch(`/tenants/${tenantId}`);
  return NextResponse.json(data, { status });
}
