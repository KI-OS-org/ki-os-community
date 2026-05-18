/**
 * KI-OS Orbit Control — AgentMesh Single Run API Proxy
 * Copyright (c) Ingo Schaffer
 *
 * GET  /api/agentmesh/runs/:runId        → run detail
 * POST /api/agentmesh/runs/:runId?action=cancel → cancel run
 */
import { NextRequest, NextResponse } from "next/server";
import { orbitFetch } from "@/lib/core/orbit-fetch";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  const { runId } = await params;
  const { data, status } = await orbitFetch(`/agentmesh/runs/${runId}`);
  return NextResponse.json(data ?? { success: false }, {
    status: status > 0 ? status : 200,
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  const { runId } = await params;
  const { searchParams } = req.nextUrl;
  const action = searchParams.get("action");
  if (action === "cancel") {
    const { data, status } = await orbitFetch(
      `/agentmesh/runs/${runId}/cancel`,
      { method: "POST", body: JSON.stringify({}) }
    );
    return NextResponse.json(data ?? { success: false }, {
      status: status > 0 ? status : 200,
    });
  }
  if (action === "retry") {
    const { data, status } = await orbitFetch(
      `/agentmesh/runs/${runId}/retry`,
      { method: "POST", body: JSON.stringify({}) }
    );
    return NextResponse.json(data ?? { success: false }, {
      status: status > 0 ? status : 202,
    });
  }
  return NextResponse.json({ success: false, error: "unknown action" }, { status: 400 });
}
