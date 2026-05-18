import type { FlowTemplate } from "./flow-types";

export function GovernancePreviewPanel({ template }: { template?: FlowTemplate }) {
  if (!template) return null;
  return (
    <section className="rounded-[24px] border border-white/10 bg-black/20 p-4 backdrop-blur">
      <h3 className="text-sm font-semibold text-white">Governance-Vorschau</h3>
      <div className="mt-3 grid gap-2">
        <div className="rounded-[18px] border border-white/8 bg-white/4 px-4 py-3">
          <div className="text-[10px] uppercase tracking-[0.2em] text-[var(--muted-foreground)]">Governance Level</div>
          <div className="mt-1 text-sm font-medium text-white">{template.governanceLevel}</div>
        </div>
        <div className="rounded-[18px] border border-white/8 bg-white/4 px-4 py-3">
          <div className="text-[10px] uppercase tracking-[0.2em] text-[var(--muted-foreground)]">Geschätzte Kosten</div>
          <div className="mt-1 text-sm font-medium text-white">{template.estimatedCost}</div>
        </div>
        <div className="rounded-[18px] border border-white/8 bg-white/4 px-4 py-3">
          <div className="text-[10px] uppercase tracking-[0.2em] text-[var(--muted-foreground)]">Policy-Hinweis</div>
          <p className="mt-1 text-xs text-[var(--muted-foreground)]">
            Budget, Residency, Privacy und Approval werden vor Connector- oder Report-Schritten aktiv.
          </p>
        </div>
      </div>
    </section>
  );
}
