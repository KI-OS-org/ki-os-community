"use client";

import { useMemo, useState } from "react";
import { NODE_LIBRARY, FLOW_TEMPLATES, type FlowNodeType } from "./flow-types";
import { FlowNodePalette } from "./node-palette";
import { FlowTemplateGrid } from "./template-grid";
import { FlowInspectorPanel } from "./flow-inspector-panel";
import { FlowTestRunPanel } from "./flow-test-run-panel";
import { GovernancePreviewPanel } from "./governance-preview-panel";

export function FlowStudioShell({ templates = FLOW_TEMPLATES }: { templates?: typeof FLOW_TEMPLATES }) {
  const [selectedNodeType, setSelectedNodeType] = useState<FlowNodeType>("aiTask");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(templates[0]?.id || "");
  const activeTemplate = useMemo(
    () => templates.find((t) => t.id === selectedTemplateId) || templates[0],
    [selectedTemplateId, templates]
  );

  return (
    <div className="grid gap-4 xl:grid-cols-[260px_minmax(0,1fr)_320px]">
      {/* Left: Node Palette + Templates */}
      <aside className="space-y-4">
        <FlowNodePalette selected={selectedNodeType} onSelect={setSelectedNodeType} />
        <FlowTemplateGrid templates={templates} selectedId={selectedTemplateId} onSelect={setSelectedTemplateId} />
      </aside>

      {/* Center: Canvas */}
      <section className="rounded-[24px] border border-white/10 bg-black/20 p-5 backdrop-blur">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-white">Canvas</h3>
            <p className="text-xs text-[var(--muted-foreground)]">
              {activeTemplate?.name} · {activeTemplate?.description}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-[var(--muted-foreground)]">
              Node-Typen: {NODE_LIBRARY.length}
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-[var(--muted-foreground)]">
              Fokus: {selectedNodeType}
            </span>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {activeTemplate?.nodes.map((node) => (
            <article
              key={node.id}
              className="rounded-[20px] border border-white/8 bg-white/4 p-4 transition hover:border-white/15 hover:bg-white/6"
            >
              <div className="mb-2 flex items-center justify-between">
                <span
                  className="rounded-full px-2 py-0.5 text-[11px]"
                  style={{
                    background: "rgba(90,196,255,0.08)",
                    border: "1px solid rgba(90,196,255,0.2)",
                    color: "var(--accent)",
                  }}
                >
                  {node.type}
                </span>
                <span className="text-[10px] text-[var(--muted-foreground)]">{node.id}</span>
              </div>
              <h4 className="text-sm font-medium text-white">{node.label}</h4>
              <p className="mt-1.5 text-xs text-[var(--muted-foreground)]">{node.summary}</p>
            </article>
          ))}
        </div>
      </section>

      {/* Right: Inspector + Governance + Testrun */}
      <aside className="space-y-4">
        <FlowInspectorPanel selectedNodeType={selectedNodeType} />
        <GovernancePreviewPanel template={activeTemplate} />
        <FlowTestRunPanel template={activeTemplate} />
      </aside>
    </div>
  );
}
