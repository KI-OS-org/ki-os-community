import { NextResponse } from "next/server";
import { orbitFetch } from "@/lib/core/orbit-fetch";

export async function GET() {
  const [live, decisions, models, scorecards] = await Promise.allSettled([
    orbitFetch("/ui/providers/live").then((r) => r.data),
    orbitFetch("/routing/decisions?limit=20").then((r) => r.data),
    orbitFetch("/ui/models").then((r) => r.data),
    orbitFetch("/routing/scorecards?limit=10").then((r) => r.data),
  ]);
  return NextResponse.json({
    live: live.status === "fulfilled" ? live.value : null,
    decisions: decisions.status === "fulfilled" ? decisions.value : null,
    models: models.status === "fulfilled" ? models.value : null,
    scorecards: scorecards.status === "fulfilled" ? scorecards.value : null,
  });
}
