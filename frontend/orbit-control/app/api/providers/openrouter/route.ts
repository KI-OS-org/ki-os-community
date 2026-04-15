import { NextResponse } from "next/server";

// Fetches the full model list from OpenRouter API
// Requires OPENROUTER_API_KEY in .env.local (optional – works without key too, returns public models)
export async function GET() {
  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "HTTP-Referer": "https://ki-os.local",
      "X-Title": "KI-OS Orbit Control",
    };
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;

    const res = await fetch("https://openrouter.ai/api/v1/models", {
      headers,
      next: { revalidate: 300 }, // cache 5 minutes
    });

    if (!res.ok) {
      return NextResponse.json({ error: "OpenRouter API error", status: res.status }, { status: 502 });
    }

    const json = await res.json();
    const models = (json.data ?? []) as Record<string, unknown>[];

    // Normalize and sort by context length desc
    const normalized = models.map((m) => ({
      id:          String(m.id ?? ""),
      name:        String(m.name ?? m.id ?? ""),
      description: String(m.description ?? ""),
      context:     Number(m.context_length ?? 0),
      pricing:     m.pricing as Record<string, unknown> | undefined,
      provider:    String(m.id ?? "").split("/")[0] ?? "unknown",
      top_provider: m.top_provider,
    }));

    // Group by provider prefix
    const grouped: Record<string, typeof normalized> = {};
    for (const m of normalized) {
      if (!grouped[m.provider]) grouped[m.provider] = [];
      grouped[m.provider].push(m);
    }

    return NextResponse.json({ models: normalized, grouped, total: normalized.length });
  } catch (err) {
    console.error("[openrouter] fetch error:", err);
    return NextResponse.json({ error: "Failed to fetch OpenRouter models" }, { status: 500 });
  }
}
