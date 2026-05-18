"use client";

import { useEffect, useState } from "react";
import { Mic, MicOff, Loader2 } from "lucide-react";

export type VoiceStatus = "idle" | "listening" | "processing" | "speaking" | "error";

interface VoiceIndicatorProps {
  status: VoiceStatus;
  className?: string;
}

/**
 * Visueller Indikator für Voice Control Status.
 * Zeigt animierte Wellen beim Aufnehmen, Spinner beim Verarbeiten.
 */
export function VoiceIndicator({ status, className = "" }: VoiceIndicatorProps) {
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    if (status === "listening") {
      const interval = setInterval(() => setPulse(p => !p), 600);
      return () => clearInterval(interval);
    }
    setPulse(false);
  }, [status]);

  const statusConfig: Record<VoiceStatus, { icon: React.ReactNode; label: string; color: string }> = {
    idle:       { icon: <MicOff className="w-5 h-5" />,                  label: "Bereit",          color: "text-gray-400" },
    listening:  { icon: <Mic className="w-5 h-5" />,                     label: "Höre zu...",      color: "text-red-400" },
    processing: { icon: <Loader2 className="w-5 h-5 animate-spin" />,    label: "Verarbeite...",   color: "text-blue-400" },
    speaking:   { icon: <Mic className="w-5 h-5" />,                     label: "KIMBA antwortet", color: "text-green-400" },
    error:      { icon: <MicOff className="w-5 h-5" />,                  label: "Fehler",          color: "text-orange-400" },
  };

  const cfg = statusConfig[status];

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {/* Animierte Wellen beim Aufnehmen */}
      {status === "listening" && (
        <div className="flex items-end gap-0.5 h-5">
          {[0.4, 0.7, 1, 0.7, 0.4].map((scale, i) => (
            <div
              key={i}
              className="w-1 bg-red-400 rounded-full transition-all duration-300"
              style={{
                height: `${pulse ? scale * 100 : scale * 40}%`,
                animationDelay: `${i * 80}ms`
              }}
            />
          ))}
        </div>
      )}

      <span className={`${cfg.color} transition-colors duration-200`}>
        {cfg.icon}
      </span>
      <span className={`text-xs font-medium ${cfg.color} transition-colors duration-200`}>
        {cfg.label}
      </span>
    </div>
  );
}

export default VoiceIndicator;
