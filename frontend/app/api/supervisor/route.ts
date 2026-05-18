import { NextResponse } from "next/server";
import { orbitFetch } from "@/lib/core/orbit-fetch";

// GET /api/supervisor?section=escalations|recoveries|playbooks|mesh
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const section = searchParams.get("section") ?? "escalations";

  const endpointMap: Record<string, string> = {
    escalations: "/supervisor/escalations",
    recoveries:  "/supervisor/recoveries",
    playbooks:   "/supervisor/playbooks",
    mesh:        "/supervisor/mesh",
  };

  const endpoint = endpointMap[section] ?? "/supervisor/escalations";
  const { data, status } = await orbitFetch(endpoint);

  // 403 = Backend-Policy verlangt höhere Rolle (admin/operator).
  // Leere Liste zurückgeben statt 403 ans Frontend durchzureichen.
  if (status === 403) {
    return NextResponse.json(
      { items: [], warning: "Insufficient role for supervisor access" },
      { status: 200 },
    );
  }

  return NextResponse.json(data ?? [], { status: status > 0 ? status : 200 });
}

// POST /api/supervisor?action=resolve|trigger|recover
export async function POST(req: Request) {
  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action") ?? "recover";
  const body = await req.json();

  const endpointMap: Record<string, string> = {
    resolve: "/supervisor/resolve",
    trigger: "/supervisor/trigger",
    recover: "/supervisor/recover",
  };

  const endpoint = endpointMap[action] ?? "/supervisor/recover";
  const { data, status } = await orbitFetch(endpoint, {
    method: "POST",
    body: JSON.stringify(body),
  });
  return NextResponse.json(data, { status: status > 0 ? status : 200 });
}
