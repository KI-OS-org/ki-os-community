import { NextResponse } from "next/server";
import { orbitFetch } from "@/lib/core/orbit-fetch";

// POST /api/campaigns/[id]/execute
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { data, status } = await orbitFetch(`/campaign/${id}/execute`, {
    method: "POST",
    body: JSON.stringify({}),
  });
  return NextResponse.json(data, { status: status > 0 ? status : 200 });
}
