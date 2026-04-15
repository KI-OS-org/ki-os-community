/**
 * Ghost Control — Overlay Component
 * 
 * Haupt-Overlay das alle Ghost-Komponenten vereint.
 * 
 * @module components/ghost/GhostOverlay
 */

'use client';

import React from 'react';
import { useGhostControl } from '@/lib/ghost/useGhostControl';
import { GhostCursor } from './GhostCursor';
import { GhostSpotlight } from './GhostSpotlight';
import { GhostCallout } from './GhostCallout';
import { GhostProgressBar } from './GhostProgressBar';
import { GhostDialog } from './GhostDialog';

export function GhostOverlay() {
  const {
    active,
    mode,
    steps,
    currentStepIndex,
    status,
    cursorPosition,
    error,
  } = useGhostControl();

  const currentStep = steps[currentStepIndex];

  // Dialog für Rückfragen
  const [dialogVisible, setDialogVisible] = React.useState(false);
  const [dialogQuestion, setDialogQuestion] = React.useState('');

  React.useEffect(() => {
    if (currentStep?.type === 'confirm' && currentStep.requiresConfirmation) {
      setDialogVisible(true);
      setDialogQuestion(currentStep.callout);
    } else {
      setDialogVisible(false);
    }
  }, [currentStep]);

  const handleDemo = () => {
    setDialogVisible(false);
    // Starte Demo-Modus
    console.log('[GhostOverlay] Demo started');
  };

  const handleBuild = () => {
    setDialogVisible(false);
    // Starte Build-Modus
    console.log('[GhostOverlay] Build started');
  };

  if (!active) {
    return null;
  }

  return (
    <>
      {/* Progress Bar (oben) */}
      <GhostProgressBar
        currentStep={currentStepIndex}
        totalSteps={steps.length}
        visible={active}
      />

      {/* Ghost Cursor */}
      <GhostCursor position={cursorPosition} visible={active} />

      {/* Ghost Spotlight */}
      <GhostSpotlight
        target={currentStep?.target || null}
        visible={active && currentStep?.type === 'spotlight'}
      />

      {/* Ghost Callout (unten) */}
      <GhostCallout
        step={currentStep || null}
        visible={active}
        currentStepIndex={currentStepIndex}
        totalSteps={steps.length}
      />

      {/* Ghost Dialog (für Rückfragen) */}
      <GhostDialog
        question={dialogQuestion}
        visible={dialogVisible}
        onDemo={handleDemo}
        onBuild={handleBuild}
      />

      {/* Error Overlay */}
      {error && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-6 text-red-400">
            <h3 className="mb-2 text-lg font-semibold">Ghost Control Error</h3>
            <p className="text-sm">{error}</p>
            <button
              className="mt-4 rounded-lg bg-red-500/10 px-4 py-2 text-sm hover:bg-red-500/20"
              onClick={() => window.location.reload()}
            >
              Reload
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export default GhostOverlay;
