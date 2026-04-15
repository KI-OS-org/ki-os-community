import { MemoryExplorer } from "@/components/memory/memory-explorer";
import { orbitFetch }     from "@/lib/core/orbit-fetch";

export default async function MemoryPage() {
  const { data } = await orbitFetch("/memory?userId=demo&limit=100");
  const items = Array.isArray((data as Record<string,unknown>)?.items)
    ? (data as Record<string,unknown[]>).items
    : [];

  return <MemoryExplorer initialItems={items} />;
}
