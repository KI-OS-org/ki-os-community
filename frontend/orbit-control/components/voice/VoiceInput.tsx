"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, Square } from "lucide-react";
import { VoiceIndicator, VoiceStatus } from "./VoiceIndicator";

interface VoiceInputProps {
  /** Wird mit dem transkribierten Text aufgerufen, sobald Whisper fertig ist. */
  onTranscript?: (text: string) => void;
  /** Wird aufgerufen wenn Kimba eine Antwort hat (Text + optional Audio-URL). */
  onReply?: (reply: string, audioUrl: string | null) => void;
  /** Sprachcode für Whisper (de, en, ...). Leer = Auto-Detect. */
  language?: string;
  /** TTS-Stimme für die Antwort. */
  voice?: string;
  /** Ob Voice Chat (STT → Kimba → TTS) aktiv ist. False = nur Transkription. */
  chatMode?: boolean;
  className?: string;
}

const WAKE_WORD = "hey ki-os";
const MIME_TYPES = ["audio/webm", "audio/mp4", "audio/ogg"];

function getSupportedMimeType(): string {
  for (const mime of MIME_TYPES) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(mime)) return mime;
  }
  return "audio/webm";
}

/**
 * Voice Input Component
 *
 * Modi:
 * - Push-to-Talk: Mic-Button gedrückt halten → aufnehmen → loslassen → transkribieren
 * - Wake Word:    "Hey KI-OS" via Browser SpeechRecognition → Push-to-Talk aktiviert
 */
export function VoiceInput({
  onTranscript,
  onReply,
  language = "",
  voice = "alloy",
  chatMode = true,
  className = "",
}: VoiceInputProps) {
  const [status, setStatus]             = useState<VoiceStatus>("idle");
  const [error, setError]               = useState<string | null>(null);
  const [wakeWordActive, setWakeWordActive] = useState(false);
  const [lastTranscript, setLastTranscript] = useState("");

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef        = useRef<Blob[]>([]);
  const streamRef        = useRef<MediaStream | null>(null);
  const recognitionRef   = useRef<any>(null); // SpeechRecognition

  // ── Wake Word Setup ────────────────────────────────────────────────────────
  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous    = true;
    recognition.interimResults = true;
    recognition.lang          = language || "de-DE";

    recognition.onresult = (event: any) => {
      const transcript = Array.from(event.results)
        .map((r: any) => r[0].transcript)
        .join("")
        .toLowerCase()
        .trim();

      if (transcript.includes(WAKE_WORD) && status === "idle") {
        recognition.stop();
        startRecording();
      }
    };

    recognition.onerror = () => {}; // Silent — Wake Word ist best-effort

    recognitionRef.current = recognition;
    return () => { try { recognition.stop(); } catch {} };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language, status]);

  function startWakeWord() {
    try {
      recognitionRef.current?.start();
      setWakeWordActive(true);
    } catch {}
  }

  function stopWakeWord() {
    try {
      recognitionRef.current?.stop();
      setWakeWordActive(false);
    } catch {}
  }

  // ── Recording ─────────────────────────────────────────────────────────────
  const startRecording = useCallback(async () => {
    if (status === "listening") return;
    setError(null);
    setStatus("listening");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];

      const mimeType = getSupportedMimeType();
      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        streamRef.current = null;
        const blob = new Blob(chunksRef.current, { type: mimeType });
        await processAudio(blob, mimeType);
      };

      recorder.start(100); // 100ms chunks
    } catch (err: any) {
      setStatus("error");
      setError(err.message || "Mikrofon-Zugriff verweigert");
    }
  }, [status]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
      setStatus("processing");
    }
  }, []);

  // ── Audio → Whisper (→ optional Kimba + TTS) ──────────────────────────────
  async function processAudio(blob: Blob, mimeType: string) {
    setStatus("processing");

    try {
      // Blob → Base64
      const arrayBuffer = await blob.arrayBuffer();
      const base64 = btoa(
        new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), "")
      );

      const endpoint = chatMode ? "/api/audio/voice-chat" : "/api/audio/stt";
      const res = await fetch(endpoint, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ audio: base64, mimeType, language, voice }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "STT-Fehler");

      if (chatMode) {
        setLastTranscript(data.transcript || "");
        onTranscript?.(data.transcript || "");
        if (data.audioUrl) {
          setStatus("speaking");
          await playAudio(data.audioUrl);
        }
        onReply?.(data.reply || "", data.audioUrl || null);
      } else {
        setLastTranscript(data.text || "");
        onTranscript?.(data.text || "");
      }

      setStatus("idle");
      // Wake Word wieder aktivieren
      if (wakeWordActive) startWakeWord();
    } catch (err: any) {
      setStatus("error");
      setError(err.message || "Verarbeitungsfehler");
    }
  }

  async function playAudio(dataUrl: string): Promise<void> {
    return new Promise((resolve) => {
      const audio = new Audio(dataUrl);
      audio.onended = () => resolve();
      audio.onerror = () => resolve();
      audio.play().catch(() => resolve());
    });
  }

  // ── Push-to-Talk Handlers ─────────────────────────────────────────────────
  function onMouseDown() { if (status === "idle") startRecording(); }
  function onMouseUp()   { if (status === "listening") stopRecording(); }

  const isRecording  = status === "listening";
  const isBusy       = status === "processing" || status === "speaking";

  return (
    <div className={`flex flex-col items-center gap-3 ${className}`}>
      {/* Push-to-Talk Button */}
      <button
        onMouseDown={onMouseDown}
        onMouseUp={onMouseUp}
        onTouchStart={(e) => { e.preventDefault(); onMouseDown(); }}
        onTouchEnd={(e)   => { e.preventDefault(); onMouseUp(); }}
        disabled={isBusy}
        className={[
          "relative w-16 h-16 rounded-full flex items-center justify-center",
          "transition-all duration-200 select-none touch-none",
          "border-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
          isRecording
            ? "bg-red-500 border-red-400 scale-110 shadow-lg shadow-red-500/40"
            : isBusy
            ? "bg-gray-700 border-gray-600 cursor-not-allowed opacity-60"
            : "bg-gray-800 border-gray-600 hover:bg-gray-700 hover:border-gray-500 cursor-pointer",
        ].join(" ")}
        aria-label={isRecording ? "Aufnahme stoppen" : "Sprachaufnahme starten"}
      >
        {isRecording
          ? <Square className="w-6 h-6 text-white" />
          : <Mic    className="w-6 h-6 text-white" />
        }
        {isRecording && (
          <span className="absolute inset-0 rounded-full border-2 border-red-400 animate-ping opacity-60" />
        )}
      </button>

      {/* Status Indicator */}
      <VoiceIndicator status={status} />

      {/* Wake Word Toggle */}
      <button
        onClick={() => wakeWordActive ? stopWakeWord() : startWakeWord()}
        className={[
          "text-xs px-2 py-1 rounded transition-colors",
          wakeWordActive
            ? "text-blue-400 bg-blue-900/30 border border-blue-800"
            : "text-gray-500 hover:text-gray-400",
        ].join(" ")}
      >
        {wakeWordActive ? `Wake Word: aktiv ("Hey KI-OS")` : "Wake Word aktivieren"}
      </button>

      {/* Last Transcript */}
      {lastTranscript && (
        <p className="text-xs text-gray-400 text-center max-w-xs italic">
          "{lastTranscript}"
        </p>
      )}

      {/* Error */}
      {error && (
        <p className="text-xs text-orange-400 text-center max-w-xs">{error}</p>
      )}

      <p className="text-xs text-gray-600 text-center">
        Halten für Aufnahme · Loslassen zum Senden
      </p>
    </div>
  );
}

export default VoiceInput;
