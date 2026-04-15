/**
 * Ghost Control — Cursor Component
 * 
 * SVG Cursor der sich über das UI bewegt.
 * 
 * @module components/ghost/GhostCursor
 */

'use client';

import React from 'react';

interface GhostCursorProps {
  position: { x: number; y: number } | null;
  visible: boolean;
}

export function GhostCursor({ position, visible }: GhostCursorProps) {
  if (!visible || !position) {
    return null;
  }

  return (
    <div
      className="fixed pointer-events-none z-[9999]"
      style={{
        left: position.x,
        top: position.y,
        transform: 'translate(-50%, -50%)',
        transition: 'all 0.3s ease-out',
      }}
    >
      {/* Ghost Cursor SVG */}
      <svg
        width="48"
        height="48"
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="drop-shadow-lg"
      >
        {/* Cursor Shadow */}
        <path
          d="M8 4L8 36L18 26L28 40L34 36L24 22L36 22L8 4Z"
          fill="rgba(0,0,0,0.3)"
          transform="translate(2, 2)"
        />
        
        {/* Cursor Body */}
        <path
          d="M8 4L8 36L18 26L28 40L34 36L24 22L36 22L8 4Z"
          fill="url(#ghost-gradient)"
          stroke="rgba(90,196,255,0.8)"
          strokeWidth="2"
        />
        
        {/* Ghost Eyes */}
        <circle cx="16" cy="18" r="3" fill="rgba(90,196,255,0.9)" />
        <circle cx="26" cy="18" r="3" fill="rgba(90,196,255,0.9)" />
        <circle cx="17" cy="17" r="1.5" fill="white" />
        <circle cx="27" cy="17" r="1.5" fill="white" />
        
        {/* Ghost Smile */}
        <path
          d="M18 24Q22 28 26 24"
          stroke="rgba(90,196,255,0.9)"
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
        />
        
        {/* Gradient Definition */}
        <defs>
          <linearGradient id="ghost-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="rgba(90,196,255,0.2)" />
            <stop offset="100%" stopColor="rgba(90,196,255,0.4)" />
          </linearGradient>
        </defs>
      </svg>
      
      {/* Click Ripple Effect */}
      <div
        className="absolute rounded-full border-2 border-[#5ac4ff]"
        style={{
          width: '48px',
          height: '48px',
          left: '-24px',
          top: '-24px',
          animation: 'ripple 0.6s ease-out',
        }}
      />
      
      <style jsx>{`
        @keyframes ripple {
          0% {
            transform: scale(0.5);
            opacity: 1;
          }
          100% {
            transform: scale(1.5);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}

export default GhostCursor;
