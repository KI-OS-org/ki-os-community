/**
 * (c) 2026 KI-OS.org by Ingo Schaffer und Kimba
 * License: AGPL-3.0-only (Community) / Proprietär (Enterprise)
 * @desc Twin Playground Page — Lädt Szenarien und rendert das Playground Shell
 */

import { PlaygroundShell } from "@/components/playground/playground-shell";

type Scenario = {
  id: string;
  title: string;
  description: string;
  tags: string;
  author: string;
  stars: number;
  run_count: number;
  fork_of?: string;
};

type ScenariosResponse = {
  items?: Scenario[];
  total?: number;
};

async function fetchScenarios(limit = 20, offset = 0): Promise<Scenario[]> {
  try {
    const res = await fetch(
      `/api/playground/scenarios?limit=${limit}&offset=${offset}`,
      { cache: "no-store" }
    );
    if (!res.ok) return [];
    const data: unknown = await res.json();
    const items = (data as ScenariosResponse)?.items;
    return Array.isArray(items) ? items : [];
  } catch {
    return [];
  }
}

export const metadata = {
  title: "Twin Playground — KI-OS",
};

export default async function PlaygroundPage() {
  const scenarios = await fetchScenarios(20, 0);

  return <PlaygroundShell scenarios={scenarios} />;
}
