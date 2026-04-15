import { appConfig } from "@/lib/config";

export async function orbitFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${appConfig.apiUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`orbit_fetch_failed:${response.status}`);
  }

  return (await response.json()) as T;
}
