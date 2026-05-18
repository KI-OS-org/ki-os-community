"use client";

import { useState, useEffect, useRef } from "react";
import { Film, Image, Loader2, CheckCircle, AlertCircle, Download, RefreshCw, RotateCcw, Play, Clock } from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────

type MediaTab = "image" | "video";

type ImageResult = {
  id?:     string;
  status?: string;
  output?: string | string[];
  error?:  string;
  urls?:   { get?: string };
};

type VideoResult = {
  id?:       string;
  status?:   string;
  output?:   string | string[];
  error?:    string;
  name?:     string;
};

type JobStatus = {
  id?:     string;
  status?: string;
  output?: string | string[];
  error?:  string;
};

// ── Presets ────────────────────────────────────────────────────────────────

const IMAGE_PROVIDERS = [
  { id: "replicate", label: "Replicate (SDXL)" },
];

const VIDEO_PROVIDERS = [
  { id: "replicate", label: "Replicate" },
  { id: "vertex",    label: "Vertex Veo (Google)" },
];

const ASPECT_RATIOS = ["16:9", "9:16", "1:1", "4:3"];
const RESOLUTIONS   = ["720p", "1080p"];
const DURATIONS     = [4, 6, 8, 10];

// ── Component ──────────────────────────────────────────────────────────────

export default function MediaStudioPage() {
  const [tab, setTab] = useState<MediaTab>("image");

  // Shared
  const [prompt,   setPrompt]   = useState("");
  const [provider, setProvider] = useState("replicate");
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  // Image
  const [imageResult, setImageResult] = useState<ImageResult | null>(null);

  // Video
  const [aspectRatio,  setAspectRatio]  = useState("16:9");
  const [resolution,   setResolution]   = useState("720p");
  const [duration,     setDuration]     = useState(8);
  const [videoResult,  setVideoResult]  = useState<VideoResult | null>(null);
  const [pollJobId,    setPollJobId]    = useState<string | null>(null);
  const [pollStatus,   setPollStatus]   = useState<JobStatus | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Stop polling on unmount
  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  function startPolling(jobId: string) {
    setPollJobId(jobId);
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const r = await fetch(`/api/media?jobId=${encodeURIComponent(jobId)}&provider=${encodeURIComponent(provider)}`);
        const d: JobStatus = await r.json();
        setPollStatus(d);
        if (d.status === "succeeded" || d.status === "failed" || d.output) {
          clearInterval(pollRef.current!);
          setPollJobId(null);
        }
      } catch {
        clearInterval(pollRef.current!);
        setPollJobId(null);
      }
    }, 4000);
  }

  async function generateImage() {
    if (!prompt.trim()) return;
    setLoading(true);
    setError(null);
    setImageResult(null);
    try {
      const res  = await fetch("/api/media?type=image", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ provider, prompt }),
      });
      const data: ImageResult = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Bild-Generierungsfehler");
      setImageResult(data);
      // Wenn async job, polling starten
      if (data.id && data.status !== "succeeded" && !data.output) {
        startPolling(data.id);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Fehler");
    } finally {
      setLoading(false);
    }
  }

  async function generateVideo() {
    if (!prompt.trim()) return;
    setLoading(true);
    setError(null);
    setVideoResult(null);
    setPollStatus(null);
    try {
      const res  = await fetch("/api/media?type=video", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ provider, prompt, aspectRatio, resolution, duration }),
      });
      const data: VideoResult = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Video-Generierungsfehler");
      setVideoResult(data);
      if (data.id) startPolling(data.id);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Fehler");
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setPrompt("");
    setImageResult(null);
    setVideoResult(null);
    setPollStatus(null);
    setPollJobId(null);
    setError(null);
    if (pollRef.current) clearInterval(pollRef.current);
  }

  function getOutputUrls(result: ImageResult | VideoResult | JobStatus | null): string[] {
    if (!result) return [];
    const out = result.output;
    if (!out) return [];
    if (Array.isArray(out)) return out.filter(Boolean) as string[];
    if (typeof out === "string") return [out];
    return [];
  }

  const inputCls = "w-full bg-[#0d1117] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#5ac4ff]/50 transition-colors";
  const labelCls = "block text-xs text-gray-400 mb-1.5 font-medium";

  const currentResult = tab === "image" ? imageResult : videoResult;
  const outputUrls    = pollStatus?.output ? getOutputUrls(pollStatus) : getOutputUrls(currentResult);
  const isPolling     = !!pollJobId;
  const finalStatus   = pollStatus?.status ?? currentResult?.status;

  return (
    <div className="min-h-screen bg-[#0d1117] text-white p-6">
      <div className="max-w-2xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center gap-3">
          <Film className="text-[#5ac4ff]" size={28} />
          <div>
            <h1 className="text-2xl font-bold">Media Studio</h1>
            <p className="text-sm text-gray-400">Bild- und Video-Generierung via Replicate & Vertex Veo</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 rounded-xl bg-white/5 border border-white/10 w-fit">
          {([["image", "Bild", Image], ["video", "Video", Play]] as const).map(([id, label, Icon]) => (
            <button
              key={id}
              onClick={() => { setTab(id); reset(); setProvider("replicate"); }}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm transition-colors ${
                tab === id ? "bg-[#5ac4ff]/20 text-[#5ac4ff] border border-[#5ac4ff]/30" : "text-gray-400 hover:text-white"
              }`}
            >
              <Icon size={13} />
              {label}
            </button>
          ))}
        </div>

        {/* Form */}
        <div className="rounded-xl border border-white/10 bg-white/5 p-6 space-y-5">

          {/* Prompt */}
          <div>
            <label className={labelCls}>Prompt *</label>
            <textarea
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              rows={3}
              placeholder={tab === "image"
                ? "z.B. A futuristic city skyline at sunset, cinematic lighting..."
                : "z.B. A drone shot of a mountain valley at dawn, smooth camera movement..."}
              className={inputCls + " resize-none"}
            />
          </div>

          {/* Provider */}
          <div>
            <label className={labelCls}>Provider</label>
            <div className="flex gap-2">
              {(tab === "image" ? IMAGE_PROVIDERS : VIDEO_PROVIDERS).map(p => (
                <button
                  key={p.id}
                  onClick={() => setProvider(p.id)}
                  className={`px-3 py-1.5 rounded-xl text-sm border transition-colors ${
                    provider === p.id
                      ? "bg-[#5ac4ff]/15 border-[#5ac4ff]/40 text-[#5ac4ff]"
                      : "border-white/10 text-gray-400 hover:text-white"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Video-specific options */}
          {tab === "video" && (
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className={labelCls}>Seitenverhältnis</label>
                <div className="flex flex-wrap gap-1.5">
                  {ASPECT_RATIOS.map(r => (
                    <button key={r} onClick={() => setAspectRatio(r)}
                      className={`px-2 py-1 rounded-lg text-xs border transition-colors ${
                        aspectRatio === r ? "bg-[#5ac4ff]/15 border-[#5ac4ff]/40 text-[#5ac4ff]" : "border-white/10 text-gray-400 hover:text-white"
                      }`}>{r}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className={labelCls}>Auflösung</label>
                <div className="flex gap-1.5">
                  {RESOLUTIONS.map(r => (
                    <button key={r} onClick={() => setResolution(r)}
                      className={`px-2 py-1 rounded-lg text-xs border transition-colors ${
                        resolution === r ? "bg-[#5ac4ff]/15 border-[#5ac4ff]/40 text-[#5ac4ff]" : "border-white/10 text-gray-400 hover:text-white"
                      }`}>{r}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className={labelCls}>Dauer (Sek.)</label>
                <div className="flex gap-1.5">
                  {DURATIONS.map(d => (
                    <button key={d} onClick={() => setDuration(d)}
                      className={`px-2 py-1 rounded-lg text-xs border transition-colors ${
                        duration === d ? "bg-[#5ac4ff]/15 border-[#5ac4ff]/40 text-[#5ac4ff]" : "border-white/10 text-gray-400 hover:text-white"
                      }`}>{d}s</button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-start gap-2 px-4 py-3 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 text-sm">
            <AlertCircle size={15} className="mt-0.5 shrink-0" />
            {error}
          </div>
        )}

        {/* Polling Status */}
        {isPolling && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-[#5ac4ff]/20 bg-[#5ac4ff]/5 text-[#5ac4ff]/80 text-sm">
            <Loader2 className="animate-spin shrink-0" size={15} />
            <span>Job läuft — Status: <span className="font-medium">{finalStatus ?? "processing"}</span> — wird alle 4 Sek. aktualisiert</span>
          </div>
        )}

        {/* Result — Images */}
        {outputUrls.length > 0 && (
          <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-4 space-y-3">
            <div className="flex items-center gap-2 text-green-400 text-sm font-medium">
              <CheckCircle size={14} />
              {tab === "image" ? "Bild generiert" : "Video generiert"}
            </div>
            {outputUrls.map((url, i) => (
              <div key={i} className="space-y-2">
                {tab === "image" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={url} alt={`Output ${i + 1}`} className="rounded-lg w-full max-h-96 object-contain bg-black" />
                ) : (
                  <video controls className="w-full rounded-lg max-h-64 bg-black" src={url}>
                    <p className="text-xs text-gray-500">Video-Player nicht unterstützt</p>
                  </video>
                )}
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  download
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-gray-300 text-xs hover:text-white transition-colors"
                >
                  <Download size={12} />
                  Herunterladen
                </a>
              </div>
            ))}
          </div>
        )}

        {/* Job ID (pending / async) */}
        {(currentResult?.id && !outputUrls.length && !isPolling) && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl border border-white/10 bg-white/5 text-sm text-gray-400">
            <Clock size={13} />
            Job-ID: <span className="font-mono text-white">{currentResult.id}</span>
            <span className="ml-auto text-xs">Status: {finalStatus ?? "queued"}</span>
            <button onClick={() => startPolling(currentResult.id!)} className="flex items-center gap-1 text-[#5ac4ff] hover:underline text-xs">
              <RefreshCw size={11} /> Prüfen
            </button>
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
            onClick={tab === "image" ? generateImage : generateVideo}
            disabled={!prompt.trim() || loading}
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-[#5ac4ff]/20 border border-[#5ac4ff]/30 text-[#5ac4ff] text-sm font-medium hover:bg-[#5ac4ff]/30 transition-colors disabled:opacity-40"
          >
            {loading ? <Loader2 className="animate-spin" size={14} /> : tab === "image" ? <Image size={14} /> : <Film size={14} />}
            {loading ? "Generiere..." : tab === "image" ? "Bild generieren" : "Video generieren"}
          </button>
        </div>

      </div>
    </div>
  );
}
