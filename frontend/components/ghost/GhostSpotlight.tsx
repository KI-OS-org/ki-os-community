/**
 * Ghost Control — Spotlight Component
 * 
 * Spotlight-Effekt der Elemente hervorhebt.
 * 
 * @module components/ghost/GhostSpotlight
 */

'use client';

import React from 'react';

interface GhostSpotlightProps {
  target: string | null; // CSS-Selector
  visible: boolean;
}

export function GhostSpotlight({ target, visible }: GhostSpotlightProps) {
  const [position, setPosition] = React.useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);

  React.useEffect(() => {
    if (!visible || !target) {
      setPosition(null);
      return;
    }

    const element = document.querySelector(target);
    if (!element) {
      console.warn('[GhostSpotlight] Element not found:', target);
      return;
    }

    const rect = element.getBoundingClientRect();
    setPosition({
      x: rect.left + window.scrollX,
      y: rect.top + window.scrollY,
      width: rect.width,
      height: rect.height,
    });
  }, [target, visible]);

  if (!visible || !position) {
    return null;
  }

  return (
    <>
      {/* Spotlight Overlay */}
      <div
        className="fixed pointer-events-none z-[9998]"
        style={{
          left: 0,
          top: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(5,8,22,0.7)',
          zIndex: 9998,
        }}
      />
      
      {/* Spotlight Hole */}
      <div
        className="fixed pointer-events-none z-[9999]"
        style={{
          left: position.x - 10,
          top: position.y - 10,
          width: position.width + 20,
          height: position.height + 20,
          borderRadius: '12px',
          boxShadow: '0 0 0 9999px rgba(5,8,22,0.7)',
          border: '2px solid rgba(90,196,255,0.8)',
          animation: 'spotlight-pulse 2s ease-in-out infinite',
        }}
      />
      
      {/* Corner Markers */}
      <div
        className="fixed pointer-events-none z-[9999]"
        style={{
          left: position.x - 10,
          top: position.y - 10,
          width: '20px',
          height: '20px',
          borderTop: '3px solid rgba(90,196,255,1)',
          borderLeft: '3px solid rgba(90,196,255,1)',
          borderRadius: '4px 0 0 0',
        }}
      />
      <div
        className="fixed pointer-events-none z-[9999]"
        style={{
          right: window.innerWidth - (position.x + position.width + 10),
          top: position.y - 10,
          width: '20px',
          height: '20px',
          borderTop: '3px solid rgba(90,196,255,1)',
          borderRight: '3px solid rgba(90,196,255,1)',
          borderRadius: '0 4px 0 0',
        }}
      />
      <div
        className="fixed pointer-events-none z-[9999]"
        style={{
          left: position.x - 10,
          bottom: window.innerHeight - (position.y + position.height + 10),
          width: '20px',
          height: '20px',
          borderBottom: '3px solid rgba(90,196,255,1)',
          borderLeft: '3px solid rgba(90,196,255,1)',
          borderRadius: '0 0 0 4px',
        }}
      />
      <div
        className="fixed pointer-events-none z-[9999]"
        style={{
          right: window.innerWidth - (position.x + position.width + 10),
          bottom: window.innerHeight - (position.y + position.height + 10),
          width: '20px',
          height: '20px',
          borderBottom: '3px solid rgba(90,196,255,1)',
          borderRight: '3px solid rgba(90,196,255,1)',
          borderRadius: '0 0 4px 0',
        }}
      />
      
      <style jsx>{`
        @keyframes spotlight-pulse {
          0%, 100% {
            box-shadow: 0 0 0 9999px rgba(5,8,22,0.7),
                        0 0 20px rgba(90,196,255,0.3);
          }
          50% {
            box-shadow: 0 0 0 9999px rgba(5,8,22,0.7),
                        0 0 40px rgba(90,196,255,0.6);
          }
        }
      `}</style>
    </>
  );
}

export default GhostSpotlight;
