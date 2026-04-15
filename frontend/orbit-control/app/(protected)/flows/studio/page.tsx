"use client";

import {
  useState, useRef, useCallback, useEffect, type MouseEvent as RMouseEvent
} from "react";
import {
  ChevronLeft, Plus, Play, Save, Loader2, AlertTriangle,
  CheckCircle, Trash2, X, Workflow, Download, Upload,
  Zap, Bot, GitMerge, Filter, CircleDot
} from "lucide-react";
import Link from "next/link";

// ── Types ──────────────────────────────────────────────────────────────────

type NodeType = "trigger" | "agent" | "tool" | "condition" | "output";

interface DagNode {
  id: string;
  type: NodeType;
  label: string;
  workerType?: string;
  model?: string;
  prompt?: string;
  x: number;
  y: number;
}

interface DagEdge {
  from: string;
  to: string;
}

interface DagDef {
  dagId: string;
  name: string;
  nodes: DagNode[];
  edges: DagEdge[];
  createdAt?: string;
  updatedAt?: string;
}

type ExecStatus = "idle" | "running" | "success" | "error";

// ── Constants ──────────────────────────────────────────────────────────────

const NODE_W = 160;
const NODE_H = 52;
const GRID   = 20;

const NODE_META: Record<NodeType, { label: string; color: string; border: string; icon: React.ElementType }> = {
  trigger:   { label: "Trigger",    color: "bg-purple-500/15", border: "border-purple-500/40", icon: Zap      },
  agent:     { label: "Agent",      color: "bg-[#5ac4ff]/10",  border: "border-[#5ac4ff]/40",  icon: Bot      },
  tool:      { label: "Tool",       color: "bg-teal-500/10",   border: "border-teal-500/40",   icon: GitMerge },
  condition: { label: "Condition",  color: "bg-yellow-500/10", border: "border-yellow-500/40", icon: Filter   },
  output:    { label: "Output",     color: "bg-green-500/10",  border: "border-green-500/40",  icon: CircleDot},
};

const WORKER_TYPES = ["chat", "research", "code", "vision", "audio", "custom"];
const MODELS       = ["gpt-5.4", "claude-opus-4-6", "claude-sonnet-4-6", "gemini-1.5-pro", "deepseek-chat"];

function snap(v: number) { return Math.round(v / GRID) * GRID; }

function makeId() {
  return `node-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

// ── SVG Edge ───────────────────────────────────────────────────────────────

function EdgePath({
  fromNode, toNode, selected, onClick
}: {
  fromNode: DagNode; toNode: DagNode; selected: boolean;
  onClick: () => void;
}) {
  const x1 = fromNode.x + NODE_W;
  const y1 = fromNode.y + NODE_H / 2;
  const x2 = toNode.x;
  const y2 = toNode.y + NODE_H / 2;
  const cx  = (x1 + x2) / 2;
  const d   = `M ${x1} ${y1} C ${cx} ${y1}, ${cx} ${y2}, ${x2} ${y2}`;
  return (
    <g onClick={onClick} style={{ cursor: "pointer" }}>
      {/* hit area */}
      <path d={d} fill="none" stroke="transparent" strokeWidth={12} />
      <path
        d={d}
        fill="none"
        stroke={selected ? "#5ac4ff" : "rgba(255,255,255,0.25)"}
        strokeWidth={selected ? 2 : 1.5}
        strokeDasharray={selected ? undefined : undefined}
        markerEnd="url(#arrowhead)"
      />
    </g>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────

export default function DagStudioPage() {
  const [dagId,   setDagId]   = useState(`dag-${Date.now().toString(36)}`);
  const [dagName, setDagName] = useState("Neues DAG");
  const [nodes,   setNodes]   = useState<DagNode[]>([]);
  const [edges,   setEdges]   = useState<DagEdge[]>([]);

  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<string | null>(null); // "from-to"

  // Drag state
  const dragRef = useRef<{ id: string; ox: number; oy: number } | null>(null);
  // Edge drawing state
  const edgeRef = useRef<string | null>(null); // nodeId being connected from

  const [canvasOffset, setCanvasOffset] = useState({ x: 0, y: 0 });
  const canvasRef = useRef<HTMLDivElement>(null);

  // Panel state
  const [showProps, setShowProps]   = useState(false);
  const [savedDags, setSavedDags]   = useState<DagDef[]>([]);
  const [showLoad,  setShowLoad]    = useState(false);

  // Execution
  const [execInput,   setExecInput]   = useState('{"query": "Beispiel-Input"}');
  const [execStatus,  setExecStatus]  = useState<ExecStatus>("idle");
  const [execResult,  setExecResult]  = useState<unknown>(null);
  const [execError,   setExecError]   = useState<string | null>(null);

  const [saving,  setSaving]  = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  // ── Load DAG list ──────────────────────────────────────────────────────

  async function loadDagList() {
    try {
      const res  = await fetch("/api/dag");
      const data = await res.json();
      const list = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
      setSavedDags(list);
    } catch {}
  }

  useEffect(() => { loadDagList(); }, []);

  // ── Open saved DAG ─────────────────────────────────────────────────────

  function openDag(dag: DagDef) {
    setDagId(dag.dagId);
    setDagName(dag.name);
    // Assign default positions if missing
    const ns = (dag.nodes ?? []).map((n, i) => ({
      ...n,
      x: typeof n.x === "number" ? n.x : 80 + (i % 4) * (NODE_W + 60),
      y: typeof n.y === "number" ? n.y : 80 + Math.floor(i / 4) * (NODE_H + 80),
    }));
    setNodes(ns);
    setEdges(dag.edges ?? []);
    setSelectedNode(null);
    setSelectedEdge(null);
    setShowLoad(false);
  }

  // ── Add node ───────────────────────────────────────────────────────────

  function addNode(type: NodeType) {
    const meta = NODE_META[type];
    const id = makeId();
    setNodes(ns => [
      ...ns,
      {
        id,
        type,
        label: meta.label,
        workerType: type === "agent" ? "chat" : undefined,
        model:      type === "agent" ? "gpt-5.4" : undefined,
        x: snap(80 + (ns.length % 4) * (NODE_W + 60)),
        y: snap(80 + Math.floor(ns.length / 4) * (NODE_H + 80)),
      }
    ]);
    setSelectedNode(id);
    setShowProps(true);
  }

  // ── Delete node ────────────────────────────────────────────────────────

  function deleteNode(id: string) {
    setNodes(ns => ns.filter(n => n.id !== id));
    setEdges(es => es.filter(e => e.from !== id && e.to !== id));
    if (selectedNode === id) { setSelectedNode(null); setShowProps(false); }
  }

  // ── Delete edge ────────────────────────────────────────────────────────

  function deleteEdge(key: string) {
    const [from, to] = key.split("||");
    setEdges(es => es.filter(e => !(e.from === from && e.to === to)));
    setSelectedEdge(null);
  }

  // ── Dragging ───────────────────────────────────────────────────────────

  function onNodeMouseDown(e: RMouseEvent, id: string) {
    if ((e.target as HTMLElement).closest("[data-action]")) return;
    e.stopPropagation();
    const node = nodes.find(n => n.id === id);
    if (!node) return;
    dragRef.current = { id, ox: e.clientX - node.x, oy: e.clientY - node.y };
    setSelectedNode(id);
    setSelectedEdge(null);
    setShowProps(true);
  }

  const onMouseMove = useCallback((e: RMouseEvent) => {
    if (!dragRef.current) return;
    const { id, ox, oy } = dragRef.current;
    setNodes(ns => ns.map(n =>
      n.id === id ? { ...n, x: snap(e.clientX - ox - canvasOffset.x), y: snap(e.clientY - oy - canvasOffset.y) } : n
    ));
  }, [canvasOffset]);

  const onMouseUp = useCallback(() => { dragRef.current = null; }, []);

  // ── Canvas offset ──────────────────────────────────────────────────────

  useEffect(() => {
    if (canvasRef.current) {
      const r = canvasRef.current.getBoundingClientRect();
      setCanvasOffset({ x: r.left, y: r.top });
    }
  }, []);

  // ── Edge drawing ───────────────────────────────────────────────────────

  function startEdge(e: RMouseEvent, fromId: string) {
    e.stopPropagation();
    edgeRef.current = fromId;
  }

  function endEdge(e: RMouseEvent, toId: string) {
    e.stopPropagation();
    const fromId = edgeRef.current;
    if (!fromId || fromId === toId) { edgeRef.current = null; return; }
    // No duplicate edges
    setEdges(es => {
      if (es.some(e => e.from === fromId && e.to === toId)) return es;
      return [...es, { from: fromId, to: toId }];
    });
    edgeRef.current = null;
  }

  // ── Update node prop ───────────────────────────────────────────────────

  function updateNode(id: string, patch: Partial<DagNode>) {
    setNodes(ns => ns.map(n => n.id === id ? { ...n, ...patch } : n));
  }

  // ── Save ───────────────────────────────────────────────────────────────

  async function saveDag() {
    setSaving(true);
    setSaveMsg(null);
    try {
      const payload: DagDef = { dagId, name: dagName, nodes, edges };
      const res  = await fetch("/api/dag", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Speichern fehlgeschlagen");
      setSaveMsg("Gespeichert");
      await loadDagList();
      setTimeout(() => setSaveMsg(null), 2000);
    } catch (e: unknown) {
      setSaveMsg(e instanceof Error ? e.message : "Fehler");
    } finally {
      setSaving(false);
    }
  }

  // ── Execute ────────────────────────────────────────────────────────────

  async function executeDag() {
    setExecStatus("running");
    setExecResult(null);
    setExecError(null);
    try {
      let input: unknown;
      try { input = JSON.parse(execInput); } catch { input = { query: execInput }; }
      const res  = await fetch("/api/dag/execute", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ dagId, name: dagName, nodes, edges, input }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Ausführung fehlgeschlagen");
      setExecResult(data);
      setExecStatus("success");
    } catch (e: unknown) {
      setExecError(e instanceof Error ? e.message : "Fehler");
      setExecStatus("error");
    }
  }

  // ── Export / Import ────────────────────────────────────────────────────

  function exportDag() {
    const json = JSON.stringify({ dagId, name: dagName, nodes, edges }, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url  = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${dagId}.json`; a.click();
    URL.revokeObjectURL(url);
  }

  function importDag(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const def = JSON.parse(ev.target?.result as string) as DagDef;
        openDag(def);
      } catch {}
    };
    reader.readAsText(file);
  }

  const selNode = nodes.find(n => n.id === selectedNode);

  // ── Canvas dimensions ──────────────────────────────────────────────────

  const canvasW = Math.max(1200, ...nodes.map(n => n.x + NODE_W + 100));
  const canvasH = Math.max(700,  ...nodes.map(n => n.y + NODE_H  + 100));

  return (
    <div className="min-h-screen bg-[#0d1117] text-white flex flex-col">

      {/* ── Toolbar ── */}
      <div className="flex items-center gap-3 px-6 py-3 border-b border-white/10 bg-black/30 shrink-0">
        <Link href="/flows" className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors">
          <ChevronLeft size={15} /> Flows
        </Link>
        <div className="w-px h-5 bg-white/10" />
        <Workflow size={16} className="text-[#5ac4ff]" />
        <input
          value={dagName}
          onChange={e => setDagName(e.target.value)}
          className="bg-transparent text-sm font-semibold text-white border-b border-transparent hover:border-white/20 focus:border-[#5ac4ff]/50 focus:outline-none px-1 py-0.5 min-w-[180px]"
        />
        <span className="text-xs text-gray-500 font-mono">{dagId}</span>

        <div className="flex-1" />

        {/* Import */}
        <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/10 text-xs text-gray-400 hover:text-white cursor-pointer transition-colors">
          <Upload size={13} /> Import
          <input type="file" accept=".json" onChange={importDag} className="hidden" />
        </label>

        {/* Export */}
        <button onClick={exportDag} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/10 text-xs text-gray-400 hover:text-white transition-colors">
          <Download size={13} /> Export
        </button>

        {/* Load */}
        <button onClick={() => { setShowLoad(v => !v); loadDagList(); }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/10 text-xs text-gray-400 hover:text-white transition-colors">
          <Upload size={13} /> Laden
        </button>

        {/* Save */}
        <button onClick={saveDag} disabled={saving}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl border border-white/20 text-xs text-gray-300 hover:text-white transition-colors disabled:opacity-40">
          {saving ? <Loader2 className="animate-spin" size={13} /> : <Save size={13} />}
          {saveMsg ?? "Speichern"}
        </button>

        {/* Execute */}
        <button onClick={executeDag} disabled={execStatus === "running" || nodes.length === 0}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-[#5ac4ff]/20 border border-[#5ac4ff]/30 text-[#5ac4ff] text-xs font-medium hover:bg-[#5ac4ff]/30 transition-colors disabled:opacity-40">
          {execStatus === "running" ? <Loader2 className="animate-spin" size={13} /> : <Play size={13} />}
          {execStatus === "running" ? "Läuft..." : "Ausführen"}
        </button>
      </div>

      {/* ── Load dropdown ── */}
      {showLoad && (
        <div className="absolute top-16 right-6 z-50 w-72 rounded-xl border border-white/10 bg-[#0d1117] shadow-2xl p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-400">Gespeicherte DAGs</span>
            <button onClick={() => setShowLoad(false)}><X size={13} className="text-gray-500" /></button>
          </div>
          {savedDags.length === 0
            ? <p className="text-xs text-gray-600 py-2">Keine DAGs gespeichert</p>
            : savedDags.map(d => (
                <button key={d.dagId} onClick={() => openDag(d)}
                  className="w-full text-left flex items-center justify-between px-3 py-2 rounded-lg border border-white/10 hover:border-white/20 hover:bg-white/5 transition-colors">
                  <div>
                    <div className="text-sm text-white">{d.name}</div>
                    <div className="text-xs text-gray-500 font-mono">{d.dagId} · {d.nodes?.length ?? 0} Nodes</div>
                  </div>
                </button>
              ))
          }
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">

        {/* ── Left Palette ── */}
        <div className="w-48 shrink-0 border-r border-white/10 bg-black/20 p-4 space-y-3 overflow-y-auto">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Nodes</p>
          {(Object.entries(NODE_META) as [NodeType, typeof NODE_META[NodeType]][]).map(([type, meta]) => {
            const Icon = meta.icon;
            return (
              <button key={type} onClick={() => addNode(type)}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl border text-left text-sm transition-colors ${meta.color} ${meta.border} hover:brightness-125`}>
                <Icon size={14} />
                <span>{meta.label}</span>
                <Plus size={12} className="ml-auto opacity-50" />
              </button>
            );
          })}

          <div className="pt-2 border-t border-white/10">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Hilfe</p>
            <p className="text-xs text-gray-600 leading-relaxed">
              Node ziehen = verschieben<br />
              Grüner Punkt → auf Node ziehen = Verbindung
            </p>
          </div>
        </div>

        {/* ── Canvas ── */}
        <div
          ref={canvasRef}
          className="flex-1 overflow-auto bg-[#0a0e14] relative"
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onClick={() => { setSelectedNode(null); setSelectedEdge(null); setShowProps(false); }}
          style={{
            backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.04) 1px, transparent 1px)",
            backgroundSize: `${GRID * 2}px ${GRID * 2}px`,
          }}
        >
          <div style={{ width: canvasW, height: canvasH, position: "relative" }}>
            {/* SVG edges */}
            <svg style={{ position: "absolute", inset: 0, width: canvasW, height: canvasH, pointerEvents: "none" }} overflow="visible">
              <defs>
                <marker id="arrowhead" markerWidth="8" markerHeight="8" refX="8" refY="3" orient="auto">
                  <path d="M0,0 L0,6 L8,3 z" fill="rgba(255,255,255,0.4)" />
                </marker>
              </defs>
              {edges.map(e => {
                const fn = nodes.find(n => n.id === e.from);
                const tn = nodes.find(n => n.id === e.to);
                if (!fn || !tn) return null;
                const key = `${e.from}||${e.to}`;
                return (
                  <g key={key} style={{ pointerEvents: "all" }}>
                    <EdgePath
                      fromNode={fn} toNode={tn}
                      selected={selectedEdge === key}
                      onClick={() => { setSelectedEdge(key); setSelectedNode(null); setShowProps(false); }}
                    />
                  </g>
                );
              })}
            </svg>

            {/* Nodes */}
            {nodes.map(node => {
              const meta  = NODE_META[node.type];
              const Icon  = meta.icon;
              const isSel = selectedNode === node.id;
              return (
                <div
                  key={node.id}
                  onMouseDown={e => onNodeMouseDown(e, node.id)}
                  onMouseUp={e => endEdge(e, node.id)}
                  style={{
                    position: "absolute",
                    left: node.x,
                    top:  node.y,
                    width: NODE_W,
                    height: NODE_H,
                    userSelect: "none",
                    cursor: "grab",
                  }}
                  className={`rounded-xl border flex items-center gap-2 px-3 text-sm transition-all
                    ${meta.color} ${isSel ? "border-[#5ac4ff]" : meta.border}
                    ${isSel ? "shadow-[0_0_0_2px_rgba(90,196,255,0.3)]" : ""}`}
                >
                  <Icon size={14} className="shrink-0 opacity-70" />
                  <span className="truncate font-medium text-xs">{node.label}</span>

                  {/* Connect handle */}
                  <div
                    data-action="connect"
                    title="Verbindung ziehen"
                    onMouseDown={e => startEdge(e, node.id)}
                    style={{ position: "absolute", right: -6, top: "50%", transform: "translateY(-50%)" }}
                    className="w-3 h-3 rounded-full bg-green-400 border-2 border-[#0a0e14] cursor-crosshair hover:bg-green-300 transition-colors"
                  />

                  {/* Delete button */}
                  <button
                    data-action="delete"
                    onClick={e => { e.stopPropagation(); deleteNode(node.id); }}
                    style={{ position: "absolute", top: -7, right: -7 }}
                    className="w-4 h-4 rounded-full bg-red-500/80 border border-[#0a0e14] flex items-center justify-center opacity-0 group-hover:opacity-100 hover:!opacity-100 transition-opacity"
                  >
                    <X size={9} />
                  </button>
                </div>
              );
            })}

            {/* Empty state */}
            {nodes.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="text-center space-y-2">
                  <Workflow size={40} className="mx-auto text-gray-700" />
                  <p className="text-sm text-gray-600">Node aus der Palette wählen</p>
                  <p className="text-xs text-gray-700">oder bestehende DAG laden</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Right Panel ── */}
        {(showProps && selNode || selectedEdge) && (
          <div className="w-72 shrink-0 border-l border-white/10 bg-black/20 p-4 overflow-y-auto space-y-4">
            {selectedEdge ? (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-white">Verbindung</span>
                  <button onClick={() => setSelectedEdge(null)}><X size={14} className="text-gray-500" /></button>
                </div>
                <p className="text-xs text-gray-400 font-mono break-all">{selectedEdge.replace("||", " → ")}</p>
                <button onClick={() => deleteEdge(selectedEdge!)}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl border border-red-500/30 text-red-400 text-xs hover:bg-red-500/10 transition-colors w-full">
                  <Trash2 size={12} /> Verbindung löschen
                </button>
              </>
            ) : selNode ? (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-white">Eigenschaften</span>
                  <button onClick={() => setShowProps(false)}><X size={14} className="text-gray-500" /></button>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Label</label>
                    <input
                      value={selNode.label}
                      onChange={e => updateNode(selNode.id, { label: e.target.value })}
                      className="w-full bg-[#0d1117] border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[#5ac4ff]/50"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Typ</label>
                    <select
                      value={selNode.type}
                      onChange={e => updateNode(selNode.id, { type: e.target.value as NodeType })}
                      className="w-full bg-[#0d1117] border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none"
                    >
                      {Object.keys(NODE_META).map(t => (
                        <option key={t} value={t}>{NODE_META[t as NodeType].label}</option>
                      ))}
                    </select>
                  </div>

                  {selNode.type === "agent" && (
                    <>
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">Worker Type</label>
                        <select
                          value={selNode.workerType ?? "chat"}
                          onChange={e => updateNode(selNode.id, { workerType: e.target.value })}
                          className="w-full bg-[#0d1117] border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none"
                        >
                          {WORKER_TYPES.map(w => <option key={w} value={w}>{w}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">Modell</label>
                        <select
                          value={selNode.model ?? "gpt-5.4"}
                          onChange={e => updateNode(selNode.id, { model: e.target.value })}
                          className="w-full bg-[#0d1117] border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none"
                        >
                          {MODELS.map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                      </div>
                    </>
                  )}

                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Prompt / Beschreibung</label>
                    <textarea
                      value={selNode.prompt ?? ""}
                      onChange={e => updateNode(selNode.id, { prompt: e.target.value })}
                      rows={4}
                      className="w-full bg-[#0d1117] border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[#5ac4ff]/50 resize-none text-xs"
                      placeholder="Optionaler Prompt..."
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs text-gray-500">
                    <div>X: <span className="text-white">{selNode.x}</span></div>
                    <div>Y: <span className="text-white">{selNode.y}</span></div>
                  </div>
                </div>

                <button onClick={() => deleteNode(selNode.id)}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl border border-red-500/30 text-red-400 text-xs hover:bg-red-500/10 transition-colors w-full">
                  <Trash2 size={12} /> Node löschen
                </button>
              </>
            ) : null}
          </div>
        )}
      </div>

      {/* ── Execution Panel ── */}
      <div className="border-t border-white/10 bg-black/30 px-6 py-4 space-y-3 shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Ausführungs-Input</span>
          {execStatus === "success" && <CheckCircle size={13} className="text-green-400" />}
          {execStatus === "error"   && <AlertTriangle size={13} className="text-red-400" />}
        </div>
        <div className="flex gap-3 items-start">
          <input
            value={execInput}
            onChange={e => setExecInput(e.target.value)}
            className="flex-1 bg-[#0d1117] border border-white/10 rounded-xl px-4 py-2 text-xs text-white font-mono focus:outline-none focus:border-[#5ac4ff]/50"
            placeholder='{"query": "..."}'
          />
          {execStatus === "success" && execResult && (
            <details className="flex-1 text-xs">
              <summary className="cursor-pointer text-green-400 font-medium">Ergebnis anzeigen</summary>
              <pre className="mt-2 bg-black/40 rounded-lg p-3 text-gray-200 overflow-auto max-h-40">
                {JSON.stringify(execResult, null, 2)}
              </pre>
            </details>
          )}
          {execStatus === "error" && execError && (
            <div className="flex-1 text-xs text-red-400 font-mono">{execError}</div>
          )}
        </div>
      </div>
    </div>
  );
}
