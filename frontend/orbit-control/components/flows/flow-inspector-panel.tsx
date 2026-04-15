import { NODE_LIBRARY, type FlowNodeType } from "./flow-types";

export function FlowInspectorPanel({ selectedNodeType }: { selectedNodeType: FlowNodeType }) {
  const node = NODE_LIBRARY.find((entry) => entry.type === selectedNodeType)!;
  return (
    <section className="rounded-[24px] border border-white/10 bg-black/20 p-4 backdrop-blur">
      <h3 className="text-sm font-semibold text-white">Eigenschaften</h3>
      <div className="mt-3 rounded-[18px] border border-white/8 bg-white/4 p-4">
        <div className="text-[10px] uppercase tracking-[0.2em] text-[var(--muted-foreground)]">
          Aktiver Node-Typ
        </div>
        <div className="mt-1.5 text-sm font-medium text-white">{node.title}</div>
        <p className="mt-1.5 text-xs text-[var(--muted-foreground)]">{node.description}</p>
        <ul className="mt-3 space-y-1.5 text-xs text-white/70">
          <li>· Semantischer Adapter statt roher Endpoint-Wörter</li>
          <li>· Trust / Explain kompatibel</li>
          <li>· Enterprise Feature Flags vorbereitet</li>
        </ul>
      </div>
    </section>
  );
}
