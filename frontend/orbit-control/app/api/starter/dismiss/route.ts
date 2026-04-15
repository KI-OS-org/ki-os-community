import { NextResponse } from "next/server";
import { orbitFetch } from "@/lib/core/orbit-fetch";

export async function DELETE() {
  const { data, status } = await orbitFetch("/starter/dismiss", { method: "DELETE", body: "{}" });
  return NextResponse.json(data ?? { success: true }, { status: status > 0 ? status : 200 });
}
