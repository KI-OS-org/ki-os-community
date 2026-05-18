import { NextResponse } from "next/server";
import { orbitFetch } from "@/lib/core/orbit-fetch";

// POST /api/notifications/mark-all-read
export async function POST() {
  const { data, status } = await orbitFetch("/notifications/mark-all-read", { method: "POST", body: "{}" });
  return NextResponse.json(data ?? {}, { status: status > 0 ? status : 200 });
}
