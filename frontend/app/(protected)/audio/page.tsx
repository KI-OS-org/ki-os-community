"use client";

import { useState } from "react";
import { Mic, Play, Loader2, CheckCircle, AlertCircle, Volume2, Download, RotateCcw } from "lucide-react";

// ── Voice Options ──────────────────────────────────────────────────────────
// OpenAI TTS voices
const VOICES = [
  { id: "alloy",   label: "Alloy",   lang: "EN",  desc: "Neutral, ausgewogen" },
  { id: "echo",    label: "Echo",    lang: "EN",  desc: "Männlich, klar" },
  { id: "fable",   label: "Fable",   lang: "EN",  desc: "Britisch, warm" },
  { id: "onyx",    label: "Onyx",    lang: "EN",  desc: "Tief, autoritär" },
  { id: "nova",    label: "Nova",    lang: "EN",  desc: "Weiblich, energisch" },
  { id: "shimmer", label: "Shimmer", lang: "EN",  desc: "Weiblich, sanft" },
];

const MODELS = [
  { id: "tts-1",    label: "TTS-1",    desc: "Standard — schnell" },
  { id: "tts-1-hd", label: "TTS-1 HD", desc: "High Definition" },
];

// ── Component ──────────────────────────────────────────────────────────────

export default function AudioTtsPage() {
  const [text,    setText]    = useState("");
  const [voice,   setVoice]   = useState("alloy");
  const [model,   setModel]   = useState("tts-1");
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [result,  setResult]  = useState<{ audioUrl?: string; taskId?: string; status?: string; message?: string } | null>(null);

  const charCount = text.length;
  const canSubmit = charCount >= 3 && charCount <= 4096 && !loading;

  async function submit() {
    if (!canSubmit) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res  = await fetch("/api/audio/tts", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ text, voice, model }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? data?.message ?? "TTS-Fehler");
      setResult(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unbekannter Fehler");
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setText("");
    setResult(null);
    setError(null);
  }

  const inputCls  = "w-full bg-[#0d1117] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#5ac4ff]/50 transition-colors";
  const labelCls  = "block text-xs text-gray-400 mb-1.5 font-medium";

  return (
    <div className="min-h-screen bg-[#0d1117] text-white p-6">
      <div className="max-w-2xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center gap-3">
          <Mic className="text-[#5ac4ff]" size={28} />
          <div>
            <h1 className="text-2xl font-bold">Audio / TTS</h1>
            <p className="text-sm text-gray-400">Text-to-Speech — OpenAI TTS-1 / TTS-1 HD</p>
          </div>
        </div>

        {/* Form */}
        <div className="rounded-xl border border-white/10 bg-white/5 p-6 space-y-5">

          {/* Text Input */}
          <div>
            <label className={labelCls}>Text *</label>
            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              rows={5}
              placeholder="Gib hier den Text ein, der vorgelesen werden soll..."
              className={inputCls + " resize-none"}
            />
            <div className={`text-xs mt-1 ${charCount > 4096 ? "text-red-400" : "text-gray-500"}`}>
              {charCount} / 4096 Zeichen
            </div>
          </div>

          {/* Voice Selection */}
          <div>
            <label className={labelCls}>Stimme</label>
            <div className="grid grid-cols-3 gap-2">
              {VOICES.map(v => (
                <button
                  key={v.id}
                  onClick={() => setVoice(v.id)}
                  className={`flex flex-col items-start px-3 py-2 rounded-xl border text-left transition-colors ${
                    voice === v.id
                      ? "bg-[#5ac4ff]/15 border-[#5ac4ff]/40 text-white"
                      : "border-white/10 text-gray-400 hover:text-white hover:border-white/20"
                  }`}
                >
                  <span className="text-sm font-medium">{v.label}</span>
                  <span className="text-xs text-gray-500 mt-0.5">{v.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Model Selection */}
          <div>
            <label className={labelCls}>Modell</label>
            <div className="flex gap-2">
              {MODELS.map(m => (
                <button
                  key={m.id}
                  onClick={() => setModel(m.id)}
                  className={`flex-1 px-3 py-2 rounded-xl border text-sm transition-colors ${
                    model === m.id
                      ? "bg-[#5ac4ff]/15 border-[#5ac4ff]/40 text-[#5ac4ff]"
                      : "border-white/10 text-gray-400 hover:text-white"
                  }`}
                >
                  <div className="font-medium">{m.label}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{m.desc}</div>
                </button>
              ))}
            </div>
          </div>

        </div>

        {/* Error */}
        {error && (
          <div className="flex items-start gap-2 px-4 py-3 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 text-sm">
            <AlertCircle size={15} className="mt-0.5 shrink-0" />
            {error}
          </div>
        )}

        {/* Result */}
        {result && (
          <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-5 space-y-4">
            <div className="flex items-center gap-2 text-green-400 text-sm font-medium">
              <CheckCircle size={15} />
              Audio generiert
            </div>

            {result.audioUrl && (
              <div className="space-y-3">
                <audio controls className="w-full" src={result.audioUrl}>
                  <p className="text-xs text-gray-500">Audio-Player nicht unterstützt</p>
                </audio>
                <a
                  href={result.audioUrl}
                  download="tts-output.mp3"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-gray-300 text-sm hover:text-white hover:border-white/20 transition-colors"
                >
                  <Download size={13} />
                  Herunterladen
                </a>
              </div>
            )}

            {result.message && !result.audioUrl && (
              <p className="text-sm text-gray-300">{result.message}</p>
            )}

            {result.taskId && (
              <div className="text-xs text-gray-500">Task-ID: <span className="font-mono">{result.taskId}</span></div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between">
          <button
            onClick={reset}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-white/10 text-gray-400 text-sm hover:text-white hover:border-white/20 transition-colors"
          >
            <RotateCcw size={14} />
            Zurücksetzen
          </button>
          <button
            onClick={submit}
            disabled={!canSubmit}
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-[#5ac4ff]/20 border border-[#5ac4ff]/30 text-[#5ac4ff] text-sm font-medium hover:bg-[#5ac4ff]/30 transition-colors disabled:opacity-40"
          >
            {loading ? <Loader2 className="animate-spin" size={14} /> : <Volume2 size={14} />}
            {loading ? "Generiere..." : "Sprechen"}
          </button>
        </div>

      </div>
    </div>
  );
}
