import type { FlowTemplate } from "./flow-types";

export function FlowTestRunPanel({ template }: { template?: FlowTemplate }) {
  if (!template) return null;
  return (
    <section className="rounded-[24px] border border-white/10 bg-black/20 p-4 backdrop-blur">
      <h3 className="text-sm font-semibold text-white">Node-Testlauf</h3>
      <div className="mt-3 space-y-1.5">
        {template.nodes.map((node, index) => (
          <div
            key={node.id}
            className="rounded-[18px] border border-white/8 bg-white/4 px-3 py-2.5"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm text-white">
                {index + 1}. {node.label}
              </span>
              <span className="text-[11px] text-emerald-400">bereit</span>
            </div>
            <div className="mt-0.5 text-[11px] text-[var(--muted-foreground)]">{node.type}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
