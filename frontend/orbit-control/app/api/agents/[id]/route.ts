import { NextResponse } from "next/server";
import { orbitFetch } from "@/lib/core/orbit-fetch";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { data, status } = await orbitFetch(`/agents/${id}`);
  return NextResponse.json(data, { status: status > 0 ? status : 200 });
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const { data, status } = await orbitFetch(`/agents/${id}`, { method: "PUT", body: JSON.stringify(body) });
  return NextResponse.json(data, { status: status > 0 ? status : 200 });
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { data, status } = await orbitFetch(`/agents/${id}`, { method: "DELETE" });
  return NextResponse.json(data, { status: status > 0 ? status : 200 });
}
