"use client";

/**
 * KI-OS · AgentMesh Canvas Visualisierung
 *
 * Rendering-Stack:
 *   - D3-force:       Physikalisches Layout der Agent-Nodes
 *   - HTML5 Canvas:   60fps-Render (Partikel, Glow, Connections, Task-Dots)
 *   - React/DOM:      Status-Kapseln, Labels (SVG-Overlay)
 *   - Zustand:        State (lesen via getState() im Canvas-Loop, subscribe für React)
 */

import React, { useRef, useEffect, useCallback, useState, useMemo } from "react";
import {
  forceSimulation,
  forceManyBody,
  forceCenter,
  forceCollide,
  forceLink,
  forceX,
  forceY,
  type Simulation,
  type SimulationNodeDatum,
} from "d3-force";
import { useMeshStore, AGENT_DEFS } from "@/lib/mesh-store";
import type { MeshAgent, TaskParticle } from "@/lib/mesh-store";

// ── D3 types ───────────────────────────────────────────────────────────────

interface D3Node extends SimulationNodeDatum {
  id: string;
  color: string;
  label: string;
  role: string;
}

interface D3Link {
  source: D3Node | string;
  target: D3Node | string;
  color: string;
}

// ── Layout: exakte Positionen aus index.html (SVG viewBox 960×620) ─────────
// Prozentual, damit sie auf jede Canvas-Größe skalieren.

const AGENT_LAYOUT: Record<string, { px: number; py: number }> = {
  supervisor:  { px: 480 / 960, py: 130 / 620 },
  planner:     { px: 128 / 960, py: 324 / 620 },
  research:    { px: 248 / 960, py: 324 / 620 },
  memory:      { px: 480 / 960, py: 324 / 620 },
  execution:   { px: 712 / 960, py: 324 / 620 },
  policy:      { px: 832 / 960, py: 324 / 620 },
  reviewer:    { px: 420 / 960, py: 518 / 620 },
  synthesizer: { px: 540 / 960, py: 518 / 620 },
};

// ── Mesh topology ──────────────────────────────────────────────────────────

const MESH_LINKS_DEF: { source: string; target: string; color: string }[] = [
  { source: "supervisor",  target: "planner",     color: "#5ac4ff" },
  { source: "supervisor",  target: "research",    color: "#22c55e" },
  { source: "supervisor",  target: "memory",      color: "#4a8dff" },
  { source: "supervisor",  target: "execution",   color: "#fb923c" },
  { source: "supervisor",  target: "policy",      color: "#fbbf24" },
  { source: "supervisor",  target: "reviewer",    color: "#a78bfa" },
  { source: "reviewer",    target: "synthesizer", color: "#a78bfa" },
  { source: "synthesizer", target: "supervisor",  color: "#5ac4ff" },
];

// ── Canvas colours ─────────────────────────────────────────────────────────

const COLOR = {
  bg:         "#030610",
  grid:       "rgba(90,196,255,0.025)",
  nodeBg:     "rgba(5,8,22,0.90)",
  linkBase:   "rgba(90,196,255,0.07)",
  ambient:    "rgba(90,196,255,0.18)",
};

// ── Helper: lerp, hex→rgba ─────────────────────────────────────────────────

function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }

function hexAlpha(hex: string, a: number) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
}

// ── Component ──────────────────────────────────────────────────────────────

export function AgentMeshCanvas({ className, style }: { className?: string; style?: React.CSSProperties }) {
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const wrapRef    = useRef<HTMLDivElement>(null);
  const simRef     = useRef<Simulation<D3Node, D3Link> | null>(null);
  const nodesRef   = useRef<D3Node[]>([]);
  const linksRef   = useRef<D3Link[]>([]);
  const rafRef     = useRef<number>(0);
  const sizeRef    = useRef({ w: 800, h: 500 });

  // Task progress tracked in ref (per-frame, never causes React re-render)
  const taskProgressRef = useRef<Map<string, number>>(new Map());

  // Pulse effect: agentId → timestamp of last pulse
  const pulseRef = useRef<Map<string, number>>(new Map());

  // Ambient particles
  const ambientRef = useRef<{ x: number; y: number; vx: number; vy: number; r: number }[]>([]);

  // ── Init D3 force simulation ─────────────────────────────────────────────

  const initSim = useCallback((w: number, h: number) => {
    // Nodes mit exakten Positionen aus index.html (skaliert auf Canvas-Größe)
    const nodes: D3Node[] = AGENT_DEFS.map((d) => {
      const layout = AGENT_LAYOUT[d.id] ?? { px: 0.5, py: 0.5 };
      const ax = layout.px * w;
      const ay = layout.py * h;
      return {
        id:    d.id,
        color: d.color,
        label: d.name,
        role:  d.role,
        x: ax, y: ay,
        // Feste Ankerpunkte — D3 hält sie an Position, erlaubt nur Mikro-Bewegung
        fx: ax, fy: ay,
      };
    });

    // Build links
    const nodeMap = new Map(nodes.map((n) => [n.id, n]));
    const links: D3Link[] = MESH_LINKS_DEF.map((l) => ({
      source: nodeMap.get(l.source) ?? l.source,
      target: nodeMap.get(l.target) ?? l.target,
      color:  l.color,
    }));

    nodesRef.current = nodes;
    linksRef.current = links;

    // D3 simulation: Ankerpunkte sind fix, nur sanftes Breathing via periodischem
    // fx/fy-Loslassen → leichte Drift → zurückziehen (siehe draw-Loop)
    const sim = forceSimulation<D3Node>(nodes)
      .force("charge",  forceManyBody<D3Node>().strength(-30))
      .force("collide", forceCollide<D3Node>(36))
      .alphaDecay(0.02)
      .velocityDecay(0.8);

    simRef.current = sim;

    // Ambient particles
    ambientRef.current = Array.from({ length: 50 }, () => ({
      x:  Math.random() * w,
      y:  Math.random() * h,
      vx: (Math.random() - 0.5) * 0.25,
      vy: (Math.random() - 0.5) * 0.25,
      r:  Math.random() * 1.2 + 0.3,
    }));
  }, []);

  // ── Resize handler ───────────────────────────────────────────────────────

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap   = wrapRef.current;
    if (!canvas || !wrap) return;

    function resize() {
      const w = wrap!.clientWidth  || 800;
      const h = wrap!.clientHeight || 500;
      canvas!.width  = w * devicePixelRatio;
      canvas!.height = h * devicePixelRatio;
      canvas!.style.width  = w + "px";
      canvas!.style.height = h + "px";
      sizeRef.current = { w, h };
      setCanvasW(w);
      // Re-init D3 on resize
      if (simRef.current) simRef.current.stop();
      initSim(w, h);
    }

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [initSim]);

  // ── Canvas draw ──────────────────────────────────────────────────────────

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { w, h }   = sizeRef.current;
    const dpr        = devicePixelRatio;
    const nodes      = nodesRef.current;
    const links      = linksRef.current;
    const now        = Date.now();

    ctx.save();
    ctx.scale(dpr, dpr);

    // ── Background ──
    ctx.fillStyle = COLOR.bg;
    ctx.fillRect(0, 0, w, h);

    // Subtle grid
    ctx.strokeStyle = COLOR.grid;
    ctx.lineWidth = 1;
    const step = 40;
    for (let x = 0; x < w; x += step) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
    for (let y = 0; y < h; y += step) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }

    // ── Ambient particles ──
    const pts = ambientRef.current;
    pts.forEach((p) => {
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0) p.x = w; if (p.x > w) p.x = 0;
      if (p.y < 0) p.y = h; if (p.y > h) p.y = 0;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = COLOR.ambient;
      ctx.fill();
    });

    // Ambient connector lines
    pts.forEach((p, i) => {
      for (let j = i + 1; j < pts.length; j++) {
        const q = pts[j];
        const dx = p.x - q.x; const dy = p.y - q.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < 80) {
          ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y);
          ctx.strokeStyle = `rgba(74,141,255,${0.06 * (1 - d / 80)})`;
          ctx.lineWidth = 0.5; ctx.stroke();
        }
      }
    });

    // ── Zustand state (direct read, no subscription) ──
    const meshState  = useMeshStore.getState();
    const agentMap   = new Map(meshState.agents.map((a) => [a.id, a]));
    const activeTasks = meshState.tasks;

    // ── Mesh connection lines ──
    links.forEach((link) => {
      const s = link.source as D3Node;
      const t = link.target as D3Node;
      if (!s.x || !t.x) return;

      // Check if this link has an active task flowing through it
      const hasFlow = activeTasks.some(
        (task) =>
          (task.fromAgentId === s.id && task.toAgentId === t.id) ||
          (task.fromAgentId === t.id && task.toAgentId === s.id)
      );

      const sx = s.x ?? 0;
      const sy = s.y ?? 0;
      const tx = t.x ?? 0;
      const ty = t.y ?? 0;

      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(tx, ty);

      if (hasFlow) {
        const grad = ctx.createLinearGradient(sx, sy, tx, ty);
        grad.addColorStop(0, hexAlpha(link.color, 0.5));
        grad.addColorStop(1, hexAlpha(link.color, 0.15));
        ctx.strokeStyle = grad;
        ctx.lineWidth = 2;
      } else {
        ctx.strokeStyle = COLOR.linkBase;
        ctx.lineWidth = 1;
      }
      ctx.stroke();
    });

    // ── Task particles ──
    const taskSpeed = 0.007;

    activeTasks.forEach((task) => {
      // Get or create progress
      const prog = taskProgressRef.current.get(task.id) ?? 0;
      const nextProg = Math.min(1, prog + taskSpeed);
      taskProgressRef.current.set(task.id, nextProg);

      // Lookup node positions
      const fromNode = nodes.find((n) => n.id === task.fromAgentId);
      const toNode   = nodes.find((n) => n.id === task.toAgentId);
      if (!fromNode || fromNode.x === undefined || !toNode || toNode.x === undefined) return;

      const fnx = fromNode.x; const fny = fromNode.y ?? 0;
      const tnx = toNode.x;   const tny = toNode.y ?? 0;

      // Bezier control point (perpendicular offset for curve)
      const mx = (fnx + tnx) / 2;
      const my = (fny + tny) / 2;
      const dx = tnx - fnx;
      const dy = tny - fny;
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      const ox = -dy / len * 40;
      const oy =  dx / len * 40;
      const cpx = mx + ox;
      const cpy = my + oy;

      // Quadratic bezier position at t=progress
      const t = nextProg;
      const px = (1-t)*(1-t)*fnx + 2*(1-t)*t*cpx + t*t*tnx;
      const py = (1-t)*(1-t)*fny + 2*(1-t)*t*cpy + t*t*tny;

      // Glow + dot
      const grd = ctx.createRadialGradient(px, py, 0, px, py, 9);
      grd.addColorStop(0, hexAlpha(task.color, 0.9));
      grd.addColorStop(1, hexAlpha(task.color, 0));
      ctx.beginPath();
      ctx.arc(px, py, 9, 0, Math.PI * 2);
      ctx.fillStyle = grd;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(px, py, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = task.color;
      ctx.fill();

      // Clean up completed particles
      if (nextProg >= 1) {
        taskProgressRef.current.delete(task.id);
        useMeshStore.getState().completeTask(task.id);
        // Trigger pulse on arrival
        pulseRef.current.set(task.toAgentId, now);
      }
    });

    // ── Agent nodes ──
    // Radius skaliert mit Canvas-Breite (Referenz: 960px → r=40 wie in index.html)
    const NODE_R = Math.max(18, w * 0.042);

    nodes.forEach((node) => {
      if (!node.x || !node.y) return;
      const agent  = agentMap.get(node.id);
      const status = agent?.status ?? "idle";
      const isSup  = node.id === "supervisor";
      const r      = isSup ? NODE_R * 1.05 : NODE_R;
      const pulse  = pulseRef.current.get(node.id);
      const pulseAge = pulse ? (now - pulse) / 1000 : -1;

      // Pulse ring
      if (pulseAge >= 0 && pulseAge < 0.8) {
        const progress = pulseAge / 0.8;
        const pr       = r + progress * 28;
        const alpha    = (1 - progress) * 0.6;
        ctx.beginPath();
        ctx.arc(node.x, node.y, pr, 0, Math.PI * 2);
        ctx.strokeStyle = hexAlpha(node.color, alpha);
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // Glow (larger when active/thinking)
      if (status === "active" || status === "thinking") {
        const glowR = r + 18 + Math.sin(now * 0.003) * 6;
        const grd = ctx.createRadialGradient(node.x, node.y, r - 6, node.x, node.y, glowR);
        grd.addColorStop(0, hexAlpha(node.color, 0.25));
        grd.addColorStop(1, hexAlpha(node.color, 0));
        ctx.beginPath();
        ctx.arc(node.x, node.y, glowR, 0, Math.PI * 2);
        ctx.fillStyle = grd;
        ctx.fill();
      }

      // Outer ring (status color)
      const strokeAlpha =
        status === "idle"     ? 0.3 :
        status === "thinking" ? 0.8 :
        status === "active"   ? 1.0 :
        status === "done"     ? 0.9 :
        status === "error"    ? 1.0 : 0.3;

      ctx.beginPath();
      ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
      ctx.strokeStyle = hexAlpha(node.color, strokeAlpha);
      ctx.lineWidth = status === "active" ? 2.5 : 1.5;
      ctx.stroke();

      // Fill — semi-transparent so video overlay blends through
      ctx.beginPath();
      ctx.arc(node.x, node.y, r - 2, 0, Math.PI * 2);
      ctx.fillStyle =
        status === "error"  ? "rgba(248,113,113,0.10)" :
        status === "done"   ? hexAlpha(node.color, 0.04) :
                              "rgba(5,8,22,0.35)";
      ctx.fill();

      // Status dot (top-right)
      const dotX = node.x + r * 0.66;
      const dotY = node.y - r * 0.66;
      ctx.beginPath();
      ctx.arc(dotX, dotY, 5, 0, Math.PI * 2);
      ctx.fillStyle =
        status === "idle"     ? "#4a5272" :
        status === "thinking" ? "#fbbf24" :
        status === "active"   ? "#22c55e" :
        status === "done"     ? node.color :
        status === "error"    ? "#f87171" : "#4a5272";
      ctx.fill();

      // Thinking spinner
      if (status === "thinking") {
        const spinAngle = (now * 0.003) % (Math.PI * 2);
        ctx.beginPath();
        ctx.arc(node.x, node.y, r - 6, spinAngle, spinAngle + Math.PI * 1.3);
        ctx.strokeStyle = hexAlpha(node.color, 0.6);
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // ── Labels (wie index.html: Name + Sub-Label in separater Box) ──
      const labelY  = node.y + r + 14;
      const boxW    = isSup ? 88 : 78;
      const boxH    = 26;
      const boxX    = node.x - boxW / 2;
      const boxY    = node.y + r + 4;

      // Label-Box (wie SVG rect in index.html)
      ctx.beginPath();
      ctx.roundRect(boxX, boxY, boxW, boxH, 5);
      ctx.fillStyle = "rgba(5,8,22,0.88)";
      ctx.fill();
      ctx.strokeStyle = hexAlpha(node.color, strokeAlpha * 0.8);
      ctx.lineWidth = 1.2;
      ctx.stroke();

      // Agent-Name
      ctx.fillStyle = node.color;
      ctx.font = `700 ${isSup ? 9.5 : 8.5}px system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText(node.label.toUpperCase(), node.x, labelY);

      // Sub-Label (Kürzel)
      const shortLabel = AGENT_DEFS.find((d) => d.id === node.id)?.shortLabel ?? "";
      if (shortLabel) {
        ctx.fillStyle = "#4a5272";
        ctx.font = `400 7.5px system-ui, sans-serif`;
        ctx.fillText(shortLabel, node.x, labelY + 11);
      }

      // Token count (rechts neben Label-Box, nur wenn > 0)
      const tokens = agent?.tokenCount ?? 0;
      if (tokens > 0) {
        ctx.fillStyle = hexAlpha(node.color, 0.45);
        ctx.font = "7px 'JetBrains Mono', monospace";
        ctx.textAlign = "left";
        ctx.fillText(`${tokens}t`, boxX + boxW + 3, labelY);
        ctx.textAlign = "center";
      }
    });

    ctx.restore();
  }, []);

  // ── Animation loop ───────────────────────────────────────────────────────

  useEffect(() => {
    function frame() {
      draw();
      rafRef.current = requestAnimationFrame(frame);
    }
    rafRef.current = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafRef.current);
  }, [draw]);

  // ── Phase label overlay ──────────────────────────────────────────────────

  const [phase, setPhase]       = useState("IDLE");
  const [phaseDetail, setPD]    = useState("");
  const [isRunning, setRunning] = useState(false);
  const [canvasW, setCanvasW]   = useState(800);

  useEffect(() => {
    return useMeshStore.subscribe((s) => {
      setPhase(s.phase);
      setPD(s.phaseDetail);
      setRunning(s.isRunning);
    });
  }, []);

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div
      ref={wrapRef}
      className={`relative overflow-hidden rounded-2xl ${className ?? ""}`}
      style={{ background: COLOR.bg, border: "1px solid rgba(90,196,255,0.15)", ...style }}
    >
      {/* Canvas */}
      <canvas ref={canvasRef} className="block w-full h-full" />

      {/* Video overlay — agent avatar circles, absolute over canvas */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden>
        {AGENT_DEFS.map((agent) => {
          const layout = AGENT_LAYOUT[agent.id] ?? { px: 0.5, py: 0.5 };
          // NODE_R = Math.max(18, w * 0.042) → diameter as % of canvas width
          const nodeR    = Math.max(18, canvasW * 0.042);
          const diameter = nodeR * 2 * 0.82; // slightly smaller than ring for inset look
          return (
            <video
              key={agent.id}
              src={`/${agent.id}.mp4`}
              autoPlay
              muted
              loop
              playsInline
              style={{
                position:    "absolute",
                left:        `${layout.px * 100}%`,
                top:         `${layout.py * 100}%`,
                transform:   "translate(-50%, -50%)",
                width:       diameter,
                height:      diameter,
                borderRadius: "50%",
                objectFit:   "cover",
                clipPath:    "circle(50%)",
                opacity:     0.72,
                mixBlendMode: "screen",
              }}
            />
          );
        })}
      </div>

      {/* Phase label — top-left overlay */}
      <div className="absolute top-4 left-4 pointer-events-none select-none">
        <div
          className="flex items-center gap-2 rounded-lg px-3 py-1.5"
          style={{
            background:  "rgba(5,8,22,0.82)",
            border:      "1px solid rgba(90,196,255,0.2)",
            backdropFilter: "blur(4px)",
          }}
        >
          {isRunning && (
            <span
              className="size-1.5 rounded-full animate-pulse"
              style={{ background: "#22c55e" }}
            />
          )}
          <span
            style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, color: "#5ac4ff", letterSpacing: 2 }}
          >
            {phase}
          </span>
          {phaseDetail && (
            <span style={{ fontSize: 10, color: "#6874a0" }}>
              · {phaseDetail}
            </span>
          )}
        </div>
      </div>

      {/* Branding — bottom-right */}
      <div className="absolute bottom-3 right-4 pointer-events-none select-none"
        style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 9, color: "#2a3562" }}
      >
        AgentMesh23 · KI-OS
      </div>
    </div>
  );
}
