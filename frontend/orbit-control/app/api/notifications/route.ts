import { NextResponse } from "next/server";
import { orbitFetch } from "@/lib/core/orbit-fetch";

// GET /api/notifications?unreadOnly=true&limit=50
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const unreadOnly = searchParams.get("unreadOnly") ?? "false";
  const limit      = searchParams.get("limit") ?? "50";
  const { data, status } = await orbitFetch(`/notifications?unreadOnly=${unreadOnly}&limit=${limit}`);
  return NextResponse.json(data ?? { items: [] }, { status: status > 0 ? status : 200 });
}

// POST /api/notifications — Notification erstellen (admin/operator)
export async function POST(req: Request) {
  const body = await req.json();
  const { data, status } = await orbitFetch("/notifications", {
    method: "POST",
    body: JSON.stringify(body),
  });
  return NextResponse.json(data ?? {}, { status: status > 0 ? status : 201 });
}
