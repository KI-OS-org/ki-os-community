/**
 * Ghost Control — Dialog Component
 * 
 * KIMBA Dialog-Karte für Rückfragen.
 * 
 * @module components/ghost/GhostDialog
 */

'use client';

import React from 'react';

interface GhostDialogProps {
  question: string;
  visible: boolean;
  onDemo: () => void;
  onBuild: () => void;
}

export function GhostDialog({ question, visible, onDemo, onBuild }: GhostDialogProps) {
  if (!visible) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      {/* Dialog Card */}
      <div
        className="w-full max-w-md rounded-2xl border border-white/10 bg-black/90 p-6 shadow-2xl"
        style={{
          animation: 'dialog-scale-up 0.3s ease-out',
        }}
      >
        {/* Header */}
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#5ac4ff]/10">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              className="text-[#5ac4ff]"
            >
              <path
                d="M12 2C6.48 2 2 6.48 2 12V22L4 20L6 22L8 20L10 22L12 20L14 22L16 20L18 22L20 20L22 22V12C22 6.48 17.52 2 12 2Z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle cx="9" cy="11" r="1.5" fill="currentColor" />
              <circle cx="15" cy="11" r="1.5" fill="currentColor" />
              <path
                d="M9 15C9 15 11 17 12 17C13 17 15 15 15 15"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-white">KIMBA</h3>
        </div>

        {/* Question */}
        <p className="mb-6 text-sm text-white/80">{question}</p>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-white hover:bg-white/10"
            onClick={onDemo}
          >
            👁️ Demo anzeigen
          </button>
          <button
            className="flex-1 rounded-xl bg-[#5ac4ff] px-4 py-2.5 text-sm font-medium text-black hover:bg-[#5ac4ff]/90"
            onClick={onBuild}
          >
            🚀 Direkt anlegen
          </button>
        </div>

        {/* Helper Text */}
        <p className="mt-4 text-center text-xs text-white/50">
          Demo: KIMBA zeigt wie es geht (keine Änderungen)
          <br />
          Direkt: KIMBA erstellt das Artefakt für dich
        </p>
      </div>

      <style jsx>{`
        @keyframes dialog-scale-up {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
      `}</style>
    </div>
  );
}

export default GhostDialog;
