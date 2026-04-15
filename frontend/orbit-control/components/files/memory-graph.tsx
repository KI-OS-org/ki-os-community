import type { MemoryGraphData } from "@/lib/adapters/files-memory";

type MemoryGraphProps = {
  graph: MemoryGraphData;
  activeId?: string;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyNode = any;

export function MemoryGraph({ graph, activeId }: MemoryGraphProps) {
  const nodes: AnyNode[] = Array.isArray(graph.nodes) ? graph.nodes as AnyNode[] : [];
  const edges: AnyNode[] = Array.isArray(graph.edges) ? graph.edges as AnyNode[] : [];

  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
      <div>
        <p className="text-xs uppercase tracking-[0.24em] text-white/45">Graph View</p>
        <h3 className="mt-2 text-base font-semibold text-white">Einfache Memory-Verbindungen</h3>
      </div>
      <div className="mt-4 grid gap-3">
        {nodes.map((node) => {
          const nodeId = String(node.id ?? "");
          const active = nodeId === activeId;
          const edgeCount = edges.filter((edge) => edge.from === node.id || edge.to === node.id).length;
          return (
            <div
              key={nodeId}
              className={`rounded-2xl border p-3 ${active ? "border-cyan-400/35 bg-cyan-500/10" : "border-white/10 bg-black/20"}`}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-medium text-white">{String(node.label ?? "")}</div>
                  <div className="mt-1 text-xs text-white/45">{String(node.kind ?? "")}</div>
                </div>
                <span className="text-xs text-white/45">{edgeCount} Links</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
