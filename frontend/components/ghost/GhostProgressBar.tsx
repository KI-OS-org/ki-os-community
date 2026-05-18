/**
 * Ghost Control — Progress Bar Component
 * 
 * Fortschrittsanzeige oben im Screen.
 * 
 * @module components/ghost/GhostProgressBar
 */

'use client';

import React from 'react';

interface GhostProgressBarProps {
  currentStep: number;
  totalSteps: number;
  visible: boolean;
}

export function GhostProgressBar({ currentStep, totalSteps, visible }: GhostProgressBarProps) {
  if (!visible) {
    return null;
  }

  const percentage = Math.min(((currentStep + 1) / totalSteps) * 100, 100);

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[9999] h-1 bg-white/10"
      style={{
        animation: 'progress-bar-slide-down 0.3s ease-out',
      }}
    >
      {/* Progress Fill */}
      <div
        className="h-full bg-gradient-to-r from-[#5ac4ff] to-[#5ac4ff]"
        style={{
          width: `${percentage}%`,
          transition: 'width 0.3s ease-out',
          boxShadow: '0 0 10px rgba(90,196,255,0.5)',
        }}
      />

      {/* Step Counter */}
      <div className="absolute right-4 top-2 flex items-center gap-2 text-xs font-medium text-white/70">
        <span>
          {currentStep + 1} / {totalSteps}
        </span>
      </div>

      <style jsx>{`
        @keyframes progress-bar-slide-down {
          from {
            transform: translateY(-100%);
          }
          to {
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}

export default GhostProgressBar;
