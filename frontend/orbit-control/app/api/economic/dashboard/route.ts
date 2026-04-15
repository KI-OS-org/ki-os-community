import { NextResponse } from "next/server";
import { orbitFetch } from "@/lib/core/orbit-fetch";

export async function GET() {
  const [economic, profiles, scorecards] = await Promise.all([
    orbitFetch("/economic"),
    orbitFetch("/economic/profiles"),
    orbitFetch("/economic/scorecards"),
  ]);
  const economicData = economic.data && typeof economic.data === "object" ? economic.data as Record<string, unknown> : {};
  return NextResponse.json(
    { ...economicData, profiles: profiles.data, scorecards: scorecards.data },
    { status: economic.status }
  );
}
