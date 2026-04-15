import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { tenant?: string };
  const tenant = body.tenant?.trim();
  if (!tenant) {
    return NextResponse.json({ ok: false, error: "tenant_required" }, { status: 400 });
  }
  const cookieStore = await cookies();
  cookieStore.set("orbit-active-tenant", tenant, { httpOnly: false, sameSite: "lax", path: "/" });
  return NextResponse.json({ ok: true, tenant });
}
