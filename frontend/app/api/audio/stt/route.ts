import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/audio/stt
 * Proxy zur Backend-Route POST /voice/transcribe (Whisper STT).
 * Body: { audio: "<base64>", mimeType?: string, language?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3000";

    const response = await fetch(`${backendUrl}/voice/transcribe`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-user-id": request.headers.get("x-user-id") || "guest",
        "x-role":    request.headers.get("x-role")    || "user",
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "STT proxy error" },
      { status: 500 }
    );
  }
}
