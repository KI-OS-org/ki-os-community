import { NextResponse } from "next/server";
import { orbitFetch } from "@/lib/core/orbit-fetch";

export async function GET() {
  const { data, status } = await orbitFetch("/health");
  const httpStatus = status > 0 ? status : 503;
  return NextResponse.json(data ?? { status: "offline" }, { status: httpStatus });
}
