/**
 * (c) 2026 KI-OS.org by Ingo Schaffer und Kimba
 * License: AGPL-3.0-only (Community) / Proprietär (Enterprise)
 * @desc Proxy-API für öffentliche Decision-Theater-Replay-Daten
 */

import { NextResponse } from "next/server";

const BACKEND = process.env.BACKEND_URL ?? "http://localhost:3001";

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  try {
    const res = await fetch(`${BACKEND}/api/theater/replay/${token}`, { cache: "no-store" });
    if (!res.ok) return NextResponse.json({ error: "not found" }, { status: 404 });
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
}
