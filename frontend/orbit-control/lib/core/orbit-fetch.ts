/**
 * KI-OS Orbit Control — Typed HTTP transport for frontend adapters
 * Copyright (c) Ingo Schaffer
 *
 * Zweck:
 * Zentraler Fetch-Transport für alle Frontend-Adapter. Leitet KI-OS-Backend-
 * Pfade gezielt an den Backend-Server weiter und hält frontend-lokale Next.js
 * API-Routen (`/api/...`) bewusst auf dem gleichen Origin des Frontends.
 *
 * Status:
 * INFRA
 */
export interface OrbitFetchOptions extends RequestInit { timeoutMs?: number; }
export interface OrbitFetchResponse<T> { ok: boolean; status: number; data: T; headers: Headers; }

const BACKEND_URL =
  process.env.KI_OS_API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:3000";

// Auth-Header-Defaults für Backend-Requests.
// Das Backend (runtime/local/server.js) baut ctx.pki aus x-user-id + x-role.
// Ohne diese Header → authenticated: false → 401.
// Orbit Control ist das Admin-Panel → Default-Rolle ist "admin".
// Supervisor, Governance etc. erfordern mindestens "operator" oder "admin".
const DEFAULT_USER_ID = process.env.KI_OS_DEFAULT_USER_ID || "orbit-control";
const DEFAULT_ROLE    = process.env.AUTH_DEFAULT_ROLE      || "admin";

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`request_timeout_${timeoutMs}ms`)), timeoutMs);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function isAbsolute(url: string) {
  return url.startsWith("http://") || url.startsWith("https://");
}

function resolveTarget(path: string): string {
  if (isAbsolute(path)) return path;
  if (path.startsWith("/api/")) return path;
  return `${BACKEND_URL.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;
}

export async function orbitFetch<T = unknown>(path: string, options: OrbitFetchOptions = {}): Promise<OrbitFetchResponse<T>> {
  const { timeoutMs = 8000, headers, ...rest } = options;
  const target = resolveTarget(path);

  try {
    // Backend-Requests brauchen x-user-id + x-role damit ctx.pki.authenticated = true.
    // Nur für direkte Backend-Calls (nicht für /api/-Routen die intern bleiben).
    const isBackendCall = !target.startsWith("/api/");
    const authHeaders = isBackendCall
      ? { "x-user-id": DEFAULT_USER_ID, "x-role": DEFAULT_ROLE }
      : {};

    const response = await withTimeout(
      fetch(target, {
        ...rest,
        headers: {
          "content-type": "application/json",
          ...authHeaders,
          ...(headers || {}),
        },
        cache: "no-store",
      }),
      timeoutMs,
    );

    const contentType = response.headers.get("content-type") || "";
    const isJson = contentType.includes("application/json");
    const data = isJson ? await response.json() : await response.text();

    return {
      ok: response.ok,
      status: response.status,
      data: data as T,
      headers: response.headers,
    };
  } catch {
    // Backend offline oder Timeout — gibt sicheren Fallback zurück, kein Crash
    return {
      ok: false,
      status: 0,
      data: null as T,
      headers: new Headers(),
    };
  }
}
