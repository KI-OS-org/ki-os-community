/**
 * (c) 2026 KI-OS.org by Ingo Schaffer und Kimba
 * License: AGPL-3.0-only (Community) / Proprietär (Enterprise)
 * @desc API Route — Startet einen Playground-Run
 */

import { NextResponse } from "next/server";

const BACKEND = process.env.BACKEND_URL ?? "http://localhost:3001";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const res = await fetch(`${BACKEND}/api/playground/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: "run failed" },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { error: "internal error" },
      { status: 500 }
    );
  }
}
