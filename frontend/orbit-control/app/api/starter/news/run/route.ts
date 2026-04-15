import { NextResponse } from "next/server";
import { orbitFetch } from "@/lib/core/orbit-fetch";

export async function POST() {
  const { data, status } = await orbitFetch("/starter/news/run", { method: "POST", body: "{}" });
  return NextResponse.json(data ?? { success: false }, { status: status > 0 ? status : 200 });
}
