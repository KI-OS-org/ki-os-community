import { NextResponse } from "next/server";
import { orbitFetch } from "@/lib/core/orbit-fetch";

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id") ?? "";
  const { data, status } = await orbitFetch(`/connectors/${id}`, { method: "DELETE" });
  return NextResponse.json(data, { status });
}
