/**
 * Ghost Control — Types & Interfaces
 * 
 * TypeScript-Definitionen für Ghost Control Engine.
 * 
 * @module lib/ghost/GhostPlan.types
 */

export type GhostMode = 'demo' | 'build';

export type GhostStepType =
  | 'navigate'      // Zu URL navigieren
  | 'spotlight'     // Element hervorheben
  | 'click'         // Element klicken
  | 'fill'          // Feld befüllen
  | 'api_call'      // Backend API aufrufen (nur build)
  | 'speak'         // KIMBA erklärt
  | 'wait'          // Pause
  | 'confirm';      // User-Bestätigung

export interface GhostStep {
  id: string;
  type: GhostStepType;
  target?: string;        // CSS-Selector oder Route
  value?: string;         // Wert zum Einfüllen
  payload?: object;       // API-Payload (nur build)
  callout: string;        // Erklärungstext
  duration?: number;      // ms für Animation
  requiresConfirmation?: boolean;
}

export interface GhostPlan {
  id: string;
  mode: GhostMode;
  title: string;
  description?: string;
  steps: GhostStep[];
  createdAt: string;
  sessionId: string;
}

export interface GhostState {
  active: boolean;
  mode: GhostMode | null;
  sessionId: string | null;
  currentStepIndex: number;
  steps: GhostStep[];
  status: 'idle' | 'running' | 'paused' | 'completed' | 'aborted' | 'waiting_confirmation';
  cursorPosition: { x: number; y: number } | null;
  error?: string;
}

export interface GhostContextType extends GhostState {
  // Control Functions
  start: (plan: GhostPlan) => Promise<void>;
  pause: () => void;
  resume: () => void;
  abort: () => void;
  confirm: () => void;
  nextStep: () => void;
  previousStep: () => void;
  
  // Internal Functions
  setCursorPosition: (pos: { x: number; y: number }) => void;
  setError: (error: string | undefined) => void;
}

/**
 * Ghost Plan Request/Response Types
 */
export interface GhostPlanRequest {
  goal: string;
  mode?: GhostMode;
}

export interface GhostPlanResponse {
  needsClarification: boolean;
  question?: string;
  plan?: GhostPlan;
}

/**
 * Ghost Execute Request/Response
 */
export interface GhostExecuteRequest {
  stepId: string;
  action: GhostStep;
  sessionId: string;
}

export interface GhostExecuteResponse {
  success: boolean;
  result?: any;
  error?: string;
  requiresUserConfirmation?: boolean;
}
