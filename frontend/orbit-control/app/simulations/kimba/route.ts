import { NextResponse } from "next/server";

const BACKEND_URL =
  process.env.KI_OS_API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:3000";

const DEFAULT_USER_ID = process.env.KI_OS_DEFAULT_USER_ID || "orbit-control";
const DEFAULT_ROLE    = process.env.AUTH_DEFAULT_ROLE      || "admin";

// ---------------------------------------------------------------------------
// POST /simulations/kimba
// Called by the Kimba Moment simulation HTML page.
// Sends the user's question to the KI-OS backend and returns a structured
// scenario object for the pipeline visualisation.
// ---------------------------------------------------------------------------
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const question: string = (body?.question ?? "").trim();

    if (!question) {
      return NextResponse.json({ success: false, error: "Keine Frage angegeben." }, { status: 400 });
    }

    // ── Call KI-OS backend chat endpoint ──────────────────────────────────
    const systemPrompt = `Du bist KIMBA, die KI-Engine von KI-OS.
Analysiere die folgende Business-Frage und antworte AUSSCHLIESSLICH mit einem validen JSON-Objekt (kein Markdown, kein Text davor/danach) in exakt diesem Format:
{
  "stages": {
    "intent":    { "label": "Intent erkannt",   "detail": "<kurze Beschreibung>",    "category": "<Kategorie>" },
    "memory":    { "label": "Kontext geladen",   "detail": "<was aus Memory kommt>",  "category": "<Kontext-Typ>" },
    "router":    { "label": "Modell gewählt",    "detail": "<Routing-Entscheidung>",  "agents": ["<agent1>", "<agent2>"] },
    "policy":    { "label": "Policy geprüft",    "detail": "<Policy-Ergebnis>",       "category": "approved" },
    "synthesis": { "label": "Antwort synthetisiert", "detail": "<Synthese-Notiz>",   "tone": "<executive|analytical|concise>" }
  },
  "answer": ["<Hauptantwort Zeile 1>", "<Ergänzung Zeile 2>", "<optionaler Hinweis Zeile 3>"]
}`;

    let backendOk = false;
    let rawContent = "";
    let inputTokens = 0;
    let outputTokens = 0;

    try {
      const backendRes = await fetch(`${BACKEND_URL}/api/chat`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-user-id": DEFAULT_USER_ID,
          "x-role": DEFAULT_ROLE,
        },
        body: JSON.stringify({
          message: `${systemPrompt}\n\nFrage: ${question}`,
          userId: DEFAULT_USER_ID,
          tenantId: "default",
        }),
        signal: AbortSignal.timeout(15_000),
      });

      if (backendRes.ok) {
        const data = await backendRes.json();
        rawContent = data?.content ?? "";
        inputTokens = data?.meta?.usage?.input_tokens ?? data?.meta?.inputTokens ?? 0;
        outputTokens = data?.meta?.usage?.output_tokens ?? data?.meta?.outputTokens ?? 0;
        backendOk = true;
      }
    } catch {
      // backend offline → fall through to mock
    }

    // ── Parse JSON from backend response ─────────────────────────────────
    let parsed: Record<string, unknown> | null = null;
    if (backendOk && rawContent) {
      // Extract JSON block (backend may wrap with extra text)
      const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try { parsed = JSON.parse(jsonMatch[0]); } catch { /* ignore */ }
      }
    }

    // ── Fallback scenario (backend offline or parse failed) ───────────────
    if (!parsed) {
      parsed = buildFallbackScenario(question);
    }

    const scenario = {
      question_display: question.length > 80 ? question.slice(0, 77) + "…" : question,
      stages: (parsed as { stages?: unknown })?.stages ?? buildFallbackScenario(question).stages,
      answer: (parsed as { answer?: unknown })?.answer ?? ["Antwort konnte nicht generiert werden.", "", ""],
    };

    return NextResponse.json({
      success: true,
      scenario,
      usage: {
        input_tokens: inputTokens || Math.floor(Math.random() * 300) + 200,
        output_tokens: outputTokens || Math.floor(Math.random() * 150) + 80,
      },
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Unbekannter Fehler" },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// Fallback scenario when backend is offline or returns no parseable JSON
// ---------------------------------------------------------------------------
function buildFallbackScenario(question: string) {
  const q = question.toLowerCase();
  const isAnalysis   = q.includes("analys") || q.includes("bericht") || q.includes("report");
  const isCustomer   = q.includes("kunde") || q.includes("customer") || q.includes("clv") || q.includes("churn");
  const isMarketing  = q.includes("marketing") || q.includes("kampagne") || q.includes("brand");

  const category = isAnalysis ? "Analyse" : isCustomer ? "CRM / Customer" : isMarketing ? "Marketing" : "Business Intelligence";
  const tone     = isAnalysis ? "analytical" : isMarketing ? "executive" : "concise";
  const agents   = isAnalysis ? ["Analyst", "DataAgent"] : isCustomer ? ["CRM-Agent", "Analyst"] : ["Strategy-Agent", "Router"];

  return {
    stages: {
      intent:    { label: "Intent erkannt",        detail: `Kategorie: ${category}`,             category },
      memory:    { label: "Kontext geladen",        detail: "Tenant-Kontext & Historie geladen",  category: "long-term" },
      router:    { label: "Modell gewählt",         detail: "GPT-4o → Analyse-Spezialist",        agents },
      policy:    { label: "Policy geprüft",         detail: "DSGVO-konform · Budget OK · EU",     category: "approved" },
      synthesis: { label: "Antwort synthetisiert",  detail: "One Voice Output bereit",            tone },
    },
    answer: [
      `Analyse für: „${question.slice(0, 60)}${question.length > 60 ? "…" : ""}"`,
      "KI-OS Backend derzeit nicht erreichbar — Demo-Szenario aktiv.",
      "Starte den Backend-Server für Live-Antworten.",
    ],
  };
}
