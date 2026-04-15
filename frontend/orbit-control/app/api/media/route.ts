import { NextResponse } from "next/server";
import { orbitFetch } from "@/lib/core/orbit-fetch";

// POST /api/media?type=image|video
export async function POST(req: Request) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") ?? "image";
  const body = await req.json();

  const endpoint = type === "video" ? "/media/video" : "/media/image";
  const { data, status } = await orbitFetch(endpoint, {
    method: "POST",
    body: JSON.stringify(body),
  });
  return NextResponse.json(data ?? {}, { status: status > 0 ? status : 200 });
}

// GET /api/media?jobId=xxx&provider=replicate
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const jobId    = searchParams.get("jobId") ?? "";
  const provider = searchParams.get("provider") ?? "replicate";

  const { data, status } = await orbitFetch(`/media/status?id=${encodeURIComponent(jobId)}&provider=${encodeURIComponent(provider)}`);
  return NextResponse.json(data ?? {}, { status: status > 0 ? status : 200 });
}
