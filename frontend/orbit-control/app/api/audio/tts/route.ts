import { NextResponse } from "next/server";
import { orbitFetch } from "@/lib/core/orbit-fetch";

// POST /api/audio/tts — stream TTS via backend
// Backend: POST /heygen/speak  (re-uses HeyGen endpoint, falls back to OpenAI TTS)
export async function POST(req: Request) {
  const body = await req.json();
  const { data, status } = await orbitFetch("/heygen/speak", {
    method: "POST",
    body: JSON.stringify(body),
  });
  return NextResponse.json(data ?? {}, { status: status > 0 ? status : 200 });
}
