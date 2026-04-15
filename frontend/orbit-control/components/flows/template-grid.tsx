import type { FlowTemplate } from "./flow-types";

export function FlowTemplateGrid({ templates, selectedId, onSelect }: {
  templates: FlowTemplate[];
  selectedId: string;
  onSelect: (value: string) => void;
}) {
  return (
    <section className="rounded-[24px] border border-white/10 bg-black/20 p-4 backdrop-blur">
      <h3 className="text-sm font-semibold text-white">Flow Templates</h3>
      <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">8 Templates für No-Code und Low-Code.</p>
      <div className="mt-3 grid gap-1.5">
        {templates.map((template) => (
          <button
            key={template.id}
            onClick={() => onSelect(template.id)}
            className="rounded-[18px] border p-3 text-left transition-all"
            style={{
              background: selectedId === template.id ? "rgba(34,197,94,0.06)" : "rgba(255,255,255,0.03)",
              borderColor: selectedId === template.id ? "rgba(34,197,94,0.3)" : "rgba(255,255,255,0.08)",
            }}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-white">{template.name}</span>
              <span className="text-[11px] text-[var(--muted-foreground)]">{template.estimatedCost}</span>
            </div>
            <p className="mt-1 text-xs text-[var(--muted-foreground)]">{template.description}</p>
          </button>
        ))}
      </div>
    </section>
  );
}
