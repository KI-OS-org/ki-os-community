import { NextResponse } from "next/server";
import { orbitFetch } from "@/lib/core/orbit-fetch";

export async function GET(_: Request, { params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;
  const { data, status } = await orbitFetch(`/ui/tasks/${runId}`);
  if (status === 401 || status === 403) return NextResponse.json(null, { status: 200 });
  return NextResponse.json(data, { status });
}
