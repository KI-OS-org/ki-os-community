import { NextResponse } from "next/server";

const BACKEND = process.env.BACKEND_URL || "http://localhost:3000";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const res    = await fetch(`${BACKEND}/efficiency/reports/${id}`, { signal: AbortSignal.timeout(8000) });
    const data   = await res.json().catch(() => ({}));
    if (res.status === 401 || res.status === 403)
      return NextResponse.json({ ok: false, report: null }, { status: 200 });
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ ok: false, report: null }, { status: 200 });
  }
}
