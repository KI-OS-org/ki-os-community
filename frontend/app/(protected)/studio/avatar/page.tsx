"use client";

import { useState } from "react";
import { Video, RefreshCw, Play, CheckCircle2, AlertCircle, Volume2 } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface SpeakResult {
  videoUrl?: string;
  audioUrl?: string;
  taskId?: string;
  status?: string;
  message?: string;
  durationSeconds?: number;
}

// ── Voices ────────────────────────────────────────────────────────────────────

const VOICES = [
  { id: "en-US-JennyNeural",   label: "Jenny (EN)" },
  { id: "en-US-GuyNeural",     label: "Guy (EN)" },
  { id: "de-DE-KatjaNeural",   label: "Katja (DE)" },
  { id: "de-DE-ConradNeural",  label: "Conrad (DE)" },
  { id: "fr-FR-DeniseNeural",  label: "Denise (FR)" },
];

const SPEEDS = [
  { id: "0.8",  label: "Langsam" },
  { id: "1.0",  label: "Normal" },
  { id: "1.2",  label: "Schnell" },
  { id: "1.5",  label: "Sehr schnell" },
];

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function AvatarPage() {
  const [text,    setText]    = useState("");
  const [voice,   setVoice]   = useState("en-US-JennyNeural");
  const [speed,   setSpeed]   = useState("1.0");
  const [result,  setResult]  = useState<SpeakResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const submit = async () => {
    if (!text.trim()) return;
    setLoading(true); setError(null); setResult(null);
    try {
      const res = await fetch("/api/heygen", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text, voice, speed: parseFloat(speed) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message ?? data?.error ?? "Fehler");
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unbekannter Fehler");
    } finally { setLoading(false); }
  };

  return (
    <div className="space-y-5 p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[var(--foreground)] flex items-center gap-2">
          <Video className="size-6" style={{ color: "var(--accent)" }} />
          HeyGen Avatar Studio
        </h1>
        <p className="text-sm text-[var(--muted-foreground)] mt-1">
          Text-to-Video mit KI-Avatar — Speech Synthesis und Video-Rendering
        </p>
      </div>

      {/* Form */}
      <div className="glass-card p-5 space-y-5">
        {/* Text Input */}
        <div>
          <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1.5">
            Sprechtext
          </label>
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Text eingeben, den der Avatar sprechen soll…"
            rows={5}
            className="w-full rounded-xl px-4 py-3 text-sm resize-none outline-none"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "var(--foreground)" }}
          />
          <p className="text-xs text-[var(--muted-foreground)] mt-1">{text.length} Zeichen</p>
        </div>

        {/* Voice + Speed */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1.5 flex items-center gap-1.5">
              <Volume2 className="size-3.5" /> Stimme
            </label>
            <select
              value={voice}
              onChange={e => setVoice(e.target.value)}
              className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "var(--foreground)" }}
            >
              {VOICES.map(v => <option key={v.id} value={v.id}>{v.label}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1.5">
              Geschwindigkeit
            </label>
            <select
              value={speed}
              onChange={e => setSpeed(e.target.value)}
              className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "var(--foreground)" }}
            >
              {SPEEDS.map(s => <option key={s.id} value={s.id}>{s.label} ({s.id}x)</option>)}
            </select>
          </div>
        </div>

        {/* Submit */}
        <button
          onClick={submit}
          disabled={loading || !text.trim()}
          className="flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium transition-opacity disabled:opacity-50"
          style={{ background: "rgba(90,196,255,0.15)", border: "1px solid rgba(90,196,255,0.3)", color: "#5ac4ff" }}
        >
          {loading ? <RefreshCw className="size-4 animate-spin" /> : <Play className="size-4" />}
          {loading ? "Generiere Video…" : "Avatar sprechen lassen"}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm" style={{ background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.25)" }}>
          <AlertCircle className="size-4 shrink-0" style={{ color: "#f87171" }} />
          <span style={{ color: "#f87171" }}>{error}</span>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="glass-card p-5 space-y-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="size-5" style={{ color: "#22c55e" }} />
            <h3 className="font-semibold text-[var(--foreground)]">Ergebnis</h3>
            {result.durationSeconds != null && (
              <span className="text-xs text-[var(--muted-foreground)]">{result.durationSeconds}s</span>
            )}
          </div>

          {result.status && (
            <p className="text-sm text-[var(--muted-foreground)]">
              Status: <span className="text-[var(--foreground)]">{result.status}</span>
            </p>
          )}

          {result.taskId && (
            <p className="text-sm text-[var(--muted-foreground)]">
              Task-ID: <code className="text-[var(--foreground)] font-mono text-xs">{result.taskId}</code>
            </p>
          )}

          {result.message && (
            <p className="text-sm text-[var(--muted-foreground)]">{result.message}</p>
          )}

          {/* Video Player */}
          {result.videoUrl && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-[var(--muted-foreground)]">Video</p>
              <video
                controls
                className="w-full rounded-xl overflow-hidden"
                style={{ maxHeight: "360px", border: "1px solid rgba(255,255,255,0.1)" }}
              >
                <source src={result.videoUrl} />
                <a
                  href={result.videoUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm"
                  style={{ color: "#5ac4ff" }}
                >
                  Video herunterladen
                </a>
              </video>
            </div>
          )}

          {/* Audio Player */}
          {result.audioUrl && !result.videoUrl && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-[var(--muted-foreground)]">Audio</p>
              <audio
                controls
                className="w-full"
                style={{ colorScheme: "dark" }}
              >
                <source src={result.audioUrl} />
                <a href={result.audioUrl} target="_blank" rel="noreferrer" style={{ color: "#5ac4ff" }} className="text-sm">
                  Audio herunterladen
                </a>
              </audio>
            </div>
          )}

          {/* Download Links */}
          {(result.videoUrl || result.audioUrl) && (
            <div className="flex gap-2 flex-wrap">
              {result.videoUrl && (
                <a
                  href={result.videoUrl}
                  download
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium"
                  style={{ background: "rgba(90,196,255,0.1)", border: "1px solid rgba(90,196,255,0.2)", color: "#5ac4ff" }}
                >
                  <Video className="size-3.5" /> Video herunterladen
                </a>
              )}
              {result.audioUrl && (
                <a
                  href={result.audioUrl}
                  download
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium"
                  style={{ background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.2)", color: "#22c55e" }}
                >
                  <Volume2 className="size-3.5" /> Audio herunterladen
                </a>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
