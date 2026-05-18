import { NextResponse } from "next/server";
import { orbitFetch } from "@/lib/core/orbit-fetch";

// GET /api/notifications/feed — ungelesene Notifications für Header-Bell
export async function GET() {
  const { data, status } = await orbitFetch("/notifications/feed");
  if (status === 0 || status === 401 || status === 403 || status === 404) {
    return NextResponse.json({ count: 0, items: [] }, { status: 200 });
  }
  return NextResponse.json(data ?? { count: 0, items: [] }, { status: status > 0 ? status : 200 });
}
