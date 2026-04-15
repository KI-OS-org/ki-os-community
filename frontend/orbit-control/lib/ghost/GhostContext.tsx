/**
 * Ghost Control — React Context Provider
 * 
 * Stellt Ghost Control State und Functions bereit.
 * 
 * @module lib/ghost/GhostContext
 */

'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { GhostState, GhostContextType, GhostPlan, GhostMode } from './GhostPlan.types';

const GhostContext = createContext<GhostContextType | null>(null);

interface GhostProviderProps {
  children: ReactNode;
}

export function GhostProvider({ children }: GhostProviderProps) {
  const [state, setState] = useState<GhostState>({
    active: false,
    mode: null,
    sessionId: null,
    currentStepIndex: 0,
    steps: [],
    status: 'idle',
    cursorPosition: null,
    error: undefined,
  });

  /**
   * Start Ghost Control mit einem Plan
   */
  const start = useCallback(async (plan: GhostPlan) => {
    setState({
      ...state,
      active: true,
      mode: plan.mode,
      sessionId: plan.sessionId,
      steps: plan.steps,
      currentStepIndex: 0,
      status: 'running',
      cursorPosition: { x: 0, y: 0 },
    });

    // Execution wird von GhostExecutor übernommen
  }, [state]);

  /**
   * Pause Ghost Control
   */
  const pause = useCallback(() => {
    setState(prev => ({
      ...prev,
      status: 'paused',
    }));
  }, []);

  /**
   * Resume Ghost Control
   */
  const resume = useCallback(() => {
    setState(prev => ({
      ...prev,
      status: 'running',
    }));
  }, []);

  /**
   * Abort Ghost Control
   */
  const abort = useCallback(() => {
    setState(prev => ({
      ...prev,
      status: 'aborted',
      active: false,
    }));
  }, []);

  /**
   * Confirm current step (für confirm Steps)
   */
  const confirm = useCallback(() => {
    setState(prev => ({
      ...prev,
      status: 'running',
    }));
  }, []);

  /**
   * Next Step
   */
  const nextStep = useCallback(() => {
    setState(prev => ({
      ...prev,
      currentStepIndex: Math.min(prev.currentStepIndex + 1, prev.steps.length - 1),
    }));
  }, []);

  /**
   * Previous Step
   */
  const previousStep = useCallback(() => {
    setState(prev => ({
      ...prev,
      currentStepIndex: Math.max(prev.currentStepIndex - 1, 0),
    }));
  }, []);

  /**
   * Cursor Position setzen
   */
  const setCursorPosition = useCallback((pos: { x: number; y: number }) => {
    setState(prev => ({
      ...prev,
      cursorPosition: pos,
    }));
  }, []);

  /**
   * Error setzen
   */
  const setError = useCallback((error: string | undefined) => {
    setState(prev => ({
      ...prev,
      error,
    }));
  }, []);

  const contextValue: GhostContextType = {
    ...state,
    start,
    pause,
    resume,
    abort,
    confirm,
    nextStep,
    previousStep,
    setCursorPosition,
    setError,
  };

  return (
    <GhostContext.Provider value={contextValue}>
      {children}
    </GhostContext.Provider>
  );
}

/**
 * Hook um Ghost Context zu verwenden
 */
export function useGhostControl() {
  const context = useContext(GhostContext);
  if (!context) {
    throw new Error('useGhostControl must be used within a GhostProvider');
  }
  return context;
}

export default GhostContext;
