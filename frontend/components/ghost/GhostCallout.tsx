/**
 * Ghost Control — Callout Component
 * 
 * Callout-Bar die erklärt was KIMBA gerade tut.
 * 
 * @module components/ghost/GhostCallout
 */

'use client';

import React from 'react';
import { GhostStep } from '@/lib/ghost/GhostPlan.types';

interface GhostCalloutProps {
  step: GhostStep | null;
  visible: boolean;
  currentStepIndex: number;
  totalSteps: number;
}

export function GhostCallout({ step, visible, currentStepIndex, totalSteps }: GhostCalloutProps) {
  if (!visible || !step) {
    return null;
  }

  return (
    <div
      className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[9999] w-full max-w-2xl px-4"
      style={{
        animation: 'callout-slide-up 0.3s ease-out',
      }}
    >
      {/* Callout Card */}
      <div className="rounded-2xl border border-white/10 bg-black/90 backdrop-blur-xl p-4 shadow-2xl">
        <div className="flex items-start gap-3">
          {/* Ghost Icon */}
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

          {/* Content */}
          <div className="flex-1">
            {/* Progress Dots */}
            <div className="mb-2 flex items-center gap-1">
              {Array.from({ length: Math.min(totalSteps, 10) }).map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 rounded-full transition-all ${
                    i <= currentStepIndex
                      ? 'w-4 bg-[#5ac4ff]'
                      : 'w-1.5 bg-white/20'
                  }`}
                />
              ))}
              {totalSteps > 10 && (
                <span className="ml-1 text-[10px] text-white/50">
                  +{totalSteps - 10}
                </span>
              )}
            </div>

            {/* Callout Text */}
            <p className="text-sm font-medium text-white">
              {step.callout}
            </p>

            {/* Step Info */}
            <p className="mt-1 text-xs text-white/50">
              Schritt {currentStepIndex + 1} von {totalSteps} • {step.type}
            </p>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2">
            {step.requiresConfirmation && (
              <>
                <button
                  className="rounded-lg bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/20"
                  onClick={() => console.log('[GhostCallout] Abort')}
                >
                  Abbrechen
                </button>
                <button
                  className="rounded-lg bg-[#5ac4ff]/10 px-3 py-1.5 text-xs font-medium text-[#5ac4ff] hover:bg-[#5ac4ff]/20"
                  onClick={() => console.log('[GhostCallout] Confirm')}
                >
                  Bestätigen
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes callout-slide-up {
          from {
            opacity: 0;
            transform: translate(-50%, 20px);
          }
          to {
            opacity: 1;
            transform: translate(-50%, 0);
          }
        }
      `}</style>
    </div>
  );
}

export default GhostCallout;
