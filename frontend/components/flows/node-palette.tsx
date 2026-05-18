import { NODE_LIBRARY, type FlowNodeType } from "./flow-types";

export function FlowNodePalette({ selected, onSelect }: { selected: FlowNodeType; onSelect: (value: FlowNodeType) => void }) {
  return (
    <section className="rounded-[24px] border border-white/10 bg-black/20 p-4 backdrop-blur">
      <h3 className="text-sm font-semibold text-white">Node-Bibliothek</h3>
      <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">10 Node-Typen für ernsthafte Flows.</p>
      <div className="mt-3 space-y-1.5">
        {NODE_LIBRARY.map((node) => (
          <button
            key={node.type}
            onClick={() => onSelect(node.type)}
            className="w-full rounded-[18px] border px-3 py-2.5 text-left transition-all"
            style={{
              background: selected === node.type ? "rgba(90,196,255,0.08)" : "rgba(255,255,255,0.03)",
              borderColor: selected === node.type ? "rgba(90,196,255,0.3)" : "rgba(255,255,255,0.08)",
            }}
          >
            <div className="text-sm font-medium text-white">{node.title}</div>
            <div className="mt-0.5 text-[11px] text-[var(--muted-foreground)]">{node.description}</div>
          </button>
        ))}
      </div>
    </section>
  );
}
