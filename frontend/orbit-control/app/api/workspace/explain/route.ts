import { NextResponse } from "next/server";
import { orbitFetch } from "@/lib/core/orbit-fetch";

export async function POST(request: Request) {
  const body = await request.json();
  const { data, status } = await orbitFetch("/chat", {
    method: "POST",
    body: JSON.stringify({
      messages: [
        {
          role: "system",
          content: "Du bist ein technischer Erklärer für das KI-OS-System. Erkläre Konzepte klar, präzise und auf Deutsch. Nutze Markdown mit Abschnitten, Code-Blöcken und Bullet-Points.",
        },
        {
          role: "user",
          content: body.query,
        },
      ],
      model: body.model ?? "gpt-5.4",
      stream: false,
    }),
  });
  return NextResponse.json(data, { status });
}
