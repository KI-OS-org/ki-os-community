import { NextResponse } from "next/server";
import { orbitFetch } from "@/lib/core/orbit-fetch";

export async function GET() {
  const [runs, events] = await Promise.allSettled([
    orbitFetch("/ui/runs?limit=50").then((r) => r.data),
    orbitFetch("/ui/events?limit=50").then((r) => r.data),
  ]);
  return NextResponse.json({
    runs:   runs.status   === "fulfilled" ? runs.value   : null,
    events: events.status === "fulfilled" ? events.value : null,
  });
}
