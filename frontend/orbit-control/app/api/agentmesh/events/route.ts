/**
 * KI-OS · AgentMesh SSE Proxy
 * Proxied Backend-Events an den Frontend-Client.
 * GET /api/agentmesh/events → Backend /agentmesh/events (SSE)
 *
 * Fallback: wenn Backend nicht erreichbar → leerer Stream (kein Crash).
 */
import { NextRequest } from "next/server";

const BACKEND = process.env.BACKEND_URL ?? "http://localhost:3000";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const runId  = searchParams.get("runId") ?? "";
  const qs     = runId ? `?runId=${encodeURIComponent(runId)}` : "";
  const url    = `${BACKEND}/agentmesh/events${qs}`;

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      // Send initial heartbeat
      controller.enqueue(encoder.encode(`: heartbeat\n\n`));

      let upstreamRes: Response | null = null;
      try {
        const ac = new AbortController();
        req.signal.addEventListener("abort", () => ac.abort());

        upstreamRes = await fetch(url, {
          headers: {
            Accept:        "text/event-stream",
            "Cache-Control": "no-cache",
            // Forward auth if present
            ...(req.headers.get("authorization")
              ? { authorization: req.headers.get("authorization")! }
              : {}),
          },
          signal: ac.signal,
        });
      } catch {
        // Backend not available — send a single "offline" event and keep stream alive
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: "info", message: "Backend offline — Demo-Modus" })}\n\n`)
        );
        // Keep alive with periodic comments
        const iv = setInterval(() => {
          try { controller.enqueue(encoder.encode(`: keep-alive\n\n`)); } catch { clearInterval(iv); }
        }, 25000);
        req.signal.addEventListener("abort", () => { clearInterval(iv); controller.close(); });
        return;
      }

      if (!upstreamRes.ok || !upstreamRes.body) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: "error", message: `Backend ${upstreamRes.status}` })}\n\n`)
        );
        controller.close();
        return;
      }

      const reader = upstreamRes.body.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          controller.enqueue(value);
        }
      } catch {
        // Client disconnected
      } finally {
        reader.releaseLock();
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type":  "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection":    "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
