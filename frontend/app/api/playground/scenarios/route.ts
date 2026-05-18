/**
 * (c) 2026 KI-OS.org by Ingo Schaffer und Kimba
 * License: AGPL-3.0-only (Community) / Proprietär (Enterprise)
 * @desc API Route — Lädt Szenarien vom Backend
 */

import { NextResponse } from "next/server";

const BACKEND = process.env.BACKEND_URL ?? "http://localhost:3001";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const limit = searchParams.get("limit") ?? "20";
  const offset = searchParams.get("offset") ?? "0";

  try {
    const res = await fetch(
      `${BACKEND}/api/playground/scenarios?limit=${limit}&offset=${offset}`,
      { cache: "no-store" }
    );

    if (!res.ok) {
      return NextResponse.json({ items: [], total: 0 });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ items: [], total: 0 });
  }
}
