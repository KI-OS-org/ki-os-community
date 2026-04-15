/**
 * KI-OS Orbit Control — Whiteboard Board API Route
 * Copyright (c) Ingo Schaffer
 *
 * Zweck:
 * Liefert Whiteboard-Karten für kollaborative Arbeitsflächen.
 *
 * Status:
 * PARTIAL
 */
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    ok: true,
    mode: "PARTIAL",
    boardId: "workspace-default",
    persisted: true,
    draggable: true,
    cards: [
      { id: "sticky-1", type: "sticky", title: "Next Step", x: 64, y: 72 },
      { id: "kpi-1", type: "kpi", title: "Revenue Uplift", x: 320, y: 88 },
      { id: "result-1", type: "result", title: "AI Summary", x: 590, y: 140 },
    ],
  });
}
