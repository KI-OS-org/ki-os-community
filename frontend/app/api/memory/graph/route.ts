import { NextResponse } from "next/server";
import { orbitFetch } from "@/lib/core/orbit-fetch";

export async function GET() {
  const { data, status } = await orbitFetch("/ui/memory/graph");
  return NextResponse.json(data ?? { nodes: [], edges: [] }, { status: status > 0 ? status : 200 });
}
