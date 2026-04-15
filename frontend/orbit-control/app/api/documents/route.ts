import { NextResponse } from "next/server";
import { orbitFetch } from "@/lib/core/orbit-fetch";

// POST /api/documents — process a document (PDF or Excel) as base64
export async function POST(req: Request) {
  const body = await req.json();
  const { data, status } = await orbitFetch("/document/process", {
    method: "POST",
    body: JSON.stringify(body),
  });
  return NextResponse.json(data, { status: status > 0 ? status : 200 });
}
