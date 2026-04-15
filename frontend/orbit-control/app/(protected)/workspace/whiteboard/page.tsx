"use client";

import {
  useState, useRef, useCallback, type MouseEvent as RMouseEvent, type WheelEvent
} from "react";
import {
  ChevronLeft, Plus, Trash2, X, Loader2, StickyNote,
  MessageSquare, Image, Lightbulb, Link2, AlignLeft,
  ZoomIn, ZoomOut, Maximize2, Download, Eraser
} from "lucide-react";
import Link from "next/link";

// ── Types ──────────────────────────────────────────────────────────────────

type CardType = "note" | "idea" | "question" | "link" | "text" | "explain";

interface WhiteboardCard {
  id: string;
  type: CardType;
  title: string;
  body: string;
  x: number;
  y: number;
  w: number;
  color: string;
  loading?: boolean;
}

// ── Card config ────────────────────────────────────────────────────────────

const CARD_META: Record<CardType, { label: string; icon: React.ElementType; bg: string; border: string; accent: string }> = {
  note:     { label: "Notiz",       icon: StickyNote,    bg: "bg-yellow-500/10",  border: "border-yellow-500/30",  accent: "text-yellow-300"  },
  idea:     { label: "Idee",        icon: Lightbulb,     bg: "bg-purple-500/10",  border: "border-purple-500/30",  accent: "text-purple-300"  },
  question: { label: "Frage",       icon: MessageSquare, bg: "bg-blue-500/10",    border: "border-blue-500/30",    accent: "text-blue-300"    },
  link:     { label: "Link",        icon: Link2,         bg: "bg-teal-500/10",    border: "border-teal-500/30",    accent: "text-teal-300"    },
  text:     { label: "Text",        icon: AlignLeft,     bg: "bg-white/5",        border: "border-white/15",       accent: "text-gray-300"    },
  explain:  { label: "Erklärung",   icon: Image,         bg: "bg-[#5ac4ff]/10",   border: "border-[#5ac4ff]/30",   accent: "text-[#5ac4ff]"   },
};

const GRID = 20;

function snap(v: number) { return Math.round(v / GRID) * GRID; }
function makeId() { return `card-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,5)}`; }

// ── Explain mode ───────────────────────────────────────────────────────────

async function fetchExplanation(query: string, model: string): Promise<string> {
  const res  = await fetch("/api/workspace/explain", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ query, model }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error ?? "Fehler");
  // Extract text from various response shapes
  const text = data?.choices?.[0]?.message?.content
    ?? data?.answer
    ?? data?.text
    ?? data?.output
    ?? data?.output_data
    ?? JSON.stringify(data, null, 2);
  return String(text);
}

// ── Component ──────────────────────────────────────────────────────────────

export default function WhiteboardPage() {
  const [cards,   setCards]   = useState<WhiteboardCard[]>([]);
  const [zoom,    setZoom]    = useState(1);
  const [offset,  setOffset]  = useState({ x: 0, y: 0 });
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const dragCard = useRef<{ id: string; ox: number; oy: number } | null>(null);
  const panRef   = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);

  // Explain mode
  const [explainQuery, setExplainQuery] = useState("");
  const [explainModel, setExplainModel] = useState("gpt-5.4");
  const [explainError, setExplainError] = useState<string | null>(null);

  // ── Board coordinates ──────────────────────────────────────────────────

  function toBoard(clientX: number, clientY: number) {
    const rect = boardRef.current?.getBoundingClientRect() ?? { left: 0, top: 0 };
    return {
      x: snap((clientX - rect.left - offset.x) / zoom),
      y: snap((clientY - rect.top  - offset.y) / zoom),
    };
  }

  // ── Add card ───────────────────────────────────────────────────────────

  function addCard(type: CardType, body = "", title?: string, atCenter = false) {
    const x = atCenter
      ? snap(((boardRef.current?.clientWidth  ?? 800) / 2 - offset.x) / zoom - 120)
      : snap(40 + (cards.length % 6) * (GRID * 12));
    const y = atCenter
      ? snap(((boardRef.current?.clientHeight ?? 600) / 2 - offset.y) / zoom - 80)
      : snap(40 + Math.floor(cards.length / 6) * (GRID * 8));
    const card: WhiteboardCard = {
      id:    makeId(),
      type,
      title: title ?? CARD_META[type].label,
      body,
      x, y,
      w: 240,
      color: "",
    };
    setCards(cs => [...cs, card]);
    setSelectedId(card.id);
    return card;
  }

  // ── Explain → creates "explain" card ──────────────────────────────────

  async function createExplainCard() {
    if (!explainQuery.trim()) return;
    setExplainError(null);
    const card = addCard("explain", "", explainQuery, true);
    setCards(cs => cs.map(c => c.id === card.id ? { ...c, loading: true } : c));
    try {
      const answer = await fetchExplanation(explainQuery, explainModel);
      setCards(cs => cs.map(c => c.id === card.id ? { ...c, body: answer, loading: false } : c));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Fehler";
      setExplainError(msg);
      setCards(cs => cs.map(c => c.id === card.id ? { ...c, body: `Fehler: ${msg}`, loading: false } : c));
    }
    setExplainQuery("");
  }

  // ── Delete card ────────────────────────────────────────────────────────

  function deleteCard(id: string) {
    setCards(cs => cs.filter(c => c.id !== id));
    if (selectedId === id) setSelectedId(null);
  }

  // ── Update card ────────────────────────────────────────────────────────

  function updateCard(id: string, patch: Partial<WhiteboardCard>) {
    setCards(cs => cs.map(c => c.id === id ? { ...c, ...patch } : c));
  }

  // ── Drag ───────────────────────────────────────────────────────────────

  function onCardMouseDown(e: RMouseEvent, id: string) {
    if ((e.target as HTMLElement).closest("[data-no-drag]")) return;
    e.stopPropagation();
    const card = cards.find(c => c.id === id);
    if (!card) return;
    const rect = boardRef.current?.getBoundingClientRect() ?? { left: 0, top: 0 };
    dragCard.current = {
      id,
      ox: (e.clientX - rect.left - offset.x) / zoom - card.x,
      oy: (e.clientY - rect.top  - offset.y) / zoom - card.y,
    };
    setSelectedId(id);
  }

  // ── Pan ────────────────────────────────────────────────────────────────

  function onBoardMouseDown(e: RMouseEvent) {
    if (e.button !== 1 && !e.altKey) return;
    e.preventDefault();
    panRef.current = { sx: e.clientX, sy: e.clientY, ox: offset.x, oy: offset.y };
  }

  const onMouseMove = useCallback((e: RMouseEvent) => {
    if (dragCard.current) {
      const { id, ox, oy } = dragCard.current;
      const rect = boardRef.current?.getBoundingClientRect() ?? { left: 0, top: 0 };
      setCards(cs => cs.map(c =>
        c.id === id
          ? { ...c, x: snap((e.clientX - rect.left - offset.x) / zoom - ox), y: snap((e.clientY - rect.top - offset.y) / zoom - oy) }
          : c
      ));
    }
    if (panRef.current) {
      const { sx, sy, ox, oy } = panRef.current;
      setOffset({ x: ox + e.clientX - sx, y: oy + e.clientY - sy });
    }
  }, [offset, zoom]);

  const onMouseUp = useCallback(() => {
    dragCard.current = null;
    panRef.current   = null;
  }, []);

  // ── Zoom ───────────────────────────────────────────────────────────────

  const onWheel = useCallback((e: WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    setZoom(z => Math.min(2, Math.max(0.3, z - e.deltaY * 0.001)));
  }, []);

  function resetView() { setZoom(1); setOffset({ x: 0, y: 0 }); }

  // ── Export ─────────────────────────────────────────────────────────────

  function exportBoard() {
    const json = JSON.stringify({ cards, zoom, offset }, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url  = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "whiteboard.json"; a.click();
    URL.revokeObjectURL(url);
  }

  function importBoard(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        if (data.cards) setCards(data.cards);
        if (data.zoom)  setZoom(data.zoom);
        if (data.offset) setOffset(data.offset);
      } catch {}
    };
    reader.readAsText(file);
  }

  const selCard = cards.find(c => c.id === selectedId);

  return (
    <div className="h-screen bg-[#08090c] text-white flex flex-col overflow-hidden">

      {/* ── Toolbar ── */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/10 bg-black/40 shrink-0 flex-wrap">
        <Link href="/workspace" className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors">
          <ChevronLeft size={14} /> Workspace
        </Link>
        <div className="w-px h-4 bg-white/10" />

        {/* Palette */}
        {(Object.entries(CARD_META) as [CardType, typeof CARD_META[CardType]][]).map(([type, meta]) => {
          const Icon = meta.icon;
          return (
            <button
              key={type}
              onClick={() => addCard(type)}
              title={`${meta.label} hinzufügen`}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs transition-colors ${meta.bg} ${meta.border} ${meta.accent} hover:brightness-125`}
            >
              <Icon size={12} /> {meta.label}
            </button>
          );
        })}

        <div className="flex-1" />

        {/* Zoom */}
        <button onClick={() => setZoom(z => Math.min(2, z + 0.1))} className="p-1.5 rounded-lg border border-white/10 text-gray-400 hover:text-white transition-colors">
          <ZoomIn size={14} />
        </button>
        <span className="text-xs text-gray-500 w-10 text-center">{Math.round(zoom * 100)}%</span>
        <button onClick={() => setZoom(z => Math.max(0.3, z - 0.1))} className="p-1.5 rounded-lg border border-white/10 text-gray-400 hover:text-white transition-colors">
          <ZoomOut size={14} />
        </button>
        <button onClick={resetView} title="Ansicht zurücksetzen" className="p-1.5 rounded-lg border border-white/10 text-gray-400 hover:text-white transition-colors">
          <Maximize2 size={14} />
        </button>
        <button onClick={() => setCards([])} title="Alle löschen" className="p-1.5 rounded-lg border border-white/10 text-gray-400 hover:text-red-400 transition-colors">
          <Eraser size={14} />
        </button>

        {/* Import / Export */}
        <label className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-white/10 text-xs text-gray-400 hover:text-white cursor-pointer transition-colors">
          Import <input type="file" accept=".json" onChange={importBoard} className="hidden" />
        </label>
        <button onClick={exportBoard} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-white/10 text-xs text-gray-400 hover:text-white transition-colors">
          <Download size={12} /> Export
        </button>
      </div>

      {/* ── Explain Bar ── */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-white/10 bg-black/20 shrink-0">
        <Lightbulb size={14} className="text-[#5ac4ff] shrink-0" />
        <input
          value={explainQuery}
          onChange={e => setExplainQuery(e.target.value)}
          onKeyDown={e => e.key === "Enter" && createExplainCard()}
          placeholder="Explain Mode: Was soll erklärt werden? z.B. 'Wie funktioniert der Policy-Simulator?'"
          className="flex-1 bg-transparent text-xs text-white placeholder-gray-600 focus:outline-none"
        />
        <select
          value={explainModel}
          onChange={e => setExplainModel(e.target.value)}
          className="bg-[#0d1117] border border-white/10 rounded-lg px-2 py-1 text-xs text-white focus:outline-none"
        >
          {["gpt-5.4", "claude-sonnet-4-6", "claude-opus-4-6", "gemini-1.5-pro"].map(m => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
        <button
          onClick={createExplainCard}
          disabled={!explainQuery.trim()}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#5ac4ff]/20 border border-[#5ac4ff]/30 text-[#5ac4ff] text-xs hover:bg-[#5ac4ff]/30 transition-colors disabled:opacity-40"
        >
          <Plus size={12} /> Erklären
        </button>
        {explainError && <span className="text-xs text-red-400">{explainError}</span>}
      </div>

      <div className="flex flex-1 overflow-hidden">

        {/* ── Canvas ── */}
        <div
          ref={boardRef}
          className="flex-1 overflow-hidden relative"
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseDown={onBoardMouseDown}
          onWheel={onWheel}
          onClick={() => setSelectedId(null)}
          style={{
            backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.03) 1px, transparent 1px)",
            backgroundSize: `${GRID * zoom}px ${GRID * zoom}px`,
            backgroundPosition: `${offset.x}px ${offset.y}px`,
            cursor: "default",
          }}
        >
          {/* Transform container */}
          <div style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`, transformOrigin: "0 0", position: "absolute" }}>
            {cards.map(card => {
              const meta = CARD_META[card.type];
              const Icon = meta.icon;
              const isSel = selectedId === card.id;
              return (
                <div
                  key={card.id}
                  onMouseDown={e => onCardMouseDown(e, card.id)}
                  onClick={e => { e.stopPropagation(); setSelectedId(card.id); }}
                  style={{
                    position: "absolute",
                    left: card.x,
                    top:  card.y,
                    width: card.w,
                    cursor: "grab",
                    userSelect: "none",
                  }}
                  className={`rounded-xl border flex flex-col shadow-lg transition-shadow
                    ${meta.bg} ${isSel ? "border-[#5ac4ff] shadow-[0_0_0_2px_rgba(90,196,255,0.2)]" : meta.border}`}
                >
                  {/* Card header */}
                  <div className="flex items-center gap-2 px-3 py-2 border-b border-white/10">
                    <Icon size={12} className={`shrink-0 ${meta.accent}`} />
                    <input
                      data-no-drag
                      value={card.title}
                      onChange={e => updateCard(card.id, { title: e.target.value })}
                      className="flex-1 bg-transparent text-xs font-semibold text-white focus:outline-none truncate"
                      onClick={e => e.stopPropagation()}
                    />
                    <button
                      data-no-drag
                      onClick={e => { e.stopPropagation(); deleteCard(card.id); }}
                      className="text-gray-600 hover:text-red-400 transition-colors"
                    >
                      <X size={11} />
                    </button>
                  </div>

                  {/* Card body */}
                  <div className="p-3 min-h-[60px]">
                    {card.loading ? (
                      <div className="flex items-center gap-2 text-xs text-gray-400">
                        <Loader2 size={12} className="animate-spin" /> Erkläre...
                      </div>
                    ) : (
                      <textarea
                        data-no-drag
                        value={card.body}
                        onChange={e => updateCard(card.id, { body: e.target.value })}
                        onClick={e => e.stopPropagation()}
                        className="w-full bg-transparent text-xs text-gray-200 resize-none focus:outline-none leading-relaxed"
                        rows={Math.max(3, Math.ceil(card.body.length / 36))}
                        placeholder="Text eingeben..."
                      />
                    )}
                  </div>

                  {/* Resize handle */}
                  <div
                    data-no-drag
                    style={{ position: "absolute", right: 0, bottom: 0, width: 12, height: 12, cursor: "se-resize" }}
                    onMouseDown={e => {
                      e.stopPropagation();
                      const startX = e.clientX;
                      const startW = card.w;
                      const onMove = (mv: MouseEvent) => {
                        const newW = Math.max(160, startW + (mv.clientX - startX) / zoom);
                        updateCard(card.id, { w: snap(newW) });
                      };
                      const onUp = () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
                      window.addEventListener("mousemove", onMove);
                      window.addEventListener("mouseup", onUp);
                    }}
                    className="opacity-0 hover:opacity-60 text-gray-500"
                  >
                    <svg width="12" height="12" viewBox="0 0 12 12"><path d="M4 12L12 4M8 12L12 8" stroke="currentColor" strokeWidth="1.5" /></svg>
                  </div>
                </div>
              );
            })}

            {/* Empty state */}
            {cards.length === 0 && (
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none select-none">
                <StickyNote size={48} className="mx-auto text-gray-800 mb-3" />
                <p className="text-sm text-gray-700">Whiteboard leer</p>
                <p className="text-xs text-gray-800 mt-1">Card aus der Toolbar hinzufügen oder Explain Mode nutzen</p>
              </div>
            )}
          </div>
        </div>

        {/* ── Side Panel ── */}
        {selCard && (
          <div className="w-64 shrink-0 border-l border-white/10 bg-black/30 p-4 overflow-y-auto space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-400 uppercase">Karte</span>
              <button onClick={() => setSelectedId(null)}><X size={13} className="text-gray-500" /></button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Typ</label>
                <select
                  value={selCard.type}
                  onChange={e => updateCard(selCard.id, { type: e.target.value as CardType })}
                  className="w-full bg-[#0d1117] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                >
                  {Object.keys(CARD_META).map(t => (
                    <option key={t} value={t}>{CARD_META[t as CardType].label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs text-gray-500 mb-1">Breite</label>
                <input
                  type="range" min={160} max={600} step={20}
                  value={selCard.w}
                  onChange={e => updateCard(selCard.id, { w: Number(e.target.value) })}
                  className="w-full"
                />
                <span className="text-xs text-gray-600">{selCard.w}px</span>
              </div>

              <div className="text-xs text-gray-600 space-y-0.5">
                <div>X: {selCard.x}, Y: {selCard.y}</div>
                <div>ID: <span className="font-mono">{selCard.id}</span></div>
              </div>
            </div>

            <button onClick={() => deleteCard(selCard.id)}
              className="flex items-center gap-2 px-3 py-2 rounded-xl border border-red-500/30 text-red-400 text-xs hover:bg-red-500/10 transition-colors w-full">
              <Trash2 size={12} /> Karte löschen
            </button>
          </div>
        )}
      </div>

      {/* Status bar */}
      <div className="flex items-center gap-4 px-4 py-1.5 border-t border-white/5 bg-black/30 text-xs text-gray-600 shrink-0">
        <span>{cards.length} Karten</span>
        <span>Zoom: {Math.round(zoom * 100)}%</span>
        <span>Alt+Drag = Pan | Mausrad = Zoom | SE-Ecke = Größe ändern</span>
      </div>
    </div>
  );
}
