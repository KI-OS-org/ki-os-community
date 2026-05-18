import { NextResponse } from "next/server";
import { orbitFetch } from "@/lib/core/orbit-fetch";

// GET /api/desktop?section=status|observe
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const section = searchParams.get("section") ?? "status";

  const endpointMap: Record<string, string> = {
    status:  "/desktop/status",
    observe: "/desktop/observe",
  };

  const endpoint = endpointMap[section] ?? "/desktop/status";
  const { data, status } = await orbitFetch(endpoint);
  return NextResponse.json(data ?? {}, { status: status > 0 ? status : 200 });
}

// POST /api/desktop?action=screenshot|action|stop|observe|lock|unlock
export async function POST(req: Request) {
  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action") ?? "screenshot";
  const body = await req.json().catch(() => ({}));

  const endpointMap: Record<string, string> = {
    screenshot: "/desktop/screenshot",
    action:     "/desktop/action",
    stop:       "/desktop/stop",
    observe:    "/desktop/observe",
    lock:       "/desktop/session/lock",
    unlock:     "/desktop/session/unlock",
  };

  const endpoint = endpointMap[action];
  if (!endpoint) {
    return NextResponse.json({ success: false, error: `Unknown action: ${action}` }, { status: 400 });
  }

  const { data, status } = await orbitFetch(endpoint, {
    method: "POST",
    body: JSON.stringify(body),
  });
  return NextResponse.json(data, { status: status > 0 ? status : 200 });
}
