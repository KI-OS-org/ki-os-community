import { NextRequest, NextResponse } from "next/server";

const BACKEND = process.env.BACKEND_URL || "http://localhost:3000";

async function proxy(path: string, method = "GET", body?: unknown) {
  const res = await fetch(`${BACKEND}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15000),
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 || res.status === 403)
    return NextResponse.json({ ok: false, reports: [], report: null }, { status: 200 });
  return NextResponse.json(data, { status: res.status });
}

export async function GET()  { return proxy("/efficiency/reports"); }
