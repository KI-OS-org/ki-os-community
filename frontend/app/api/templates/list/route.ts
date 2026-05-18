/**
 * KI-OS Orbit Control — Templates List API Route
 * Copyright (c) Ingo Schaffer
 *
 * Zweck:
 * Liefert die Template-Liste für den Templates-Adapter über einen
 * Next.js-API-Route-Handler innerhalb des Orbit-Control-Frontends.
 *
 * Status:
 * LIVE
 */
import { NextResponse } from "next/server";

const items = [
  { id: "ops-briefing", title: "Ops Briefing", category: "operations", status: "ready" },
  { id: "governance-review", title: "Governance Review", category: "governance", status: "ready" },
  { id: "retail-daily", title: "Retail Daily", category: "retail", status: "ready" },
];

export async function GET() {
  return NextResponse.json({ ok: true, mode: "LIVE", items });
}
