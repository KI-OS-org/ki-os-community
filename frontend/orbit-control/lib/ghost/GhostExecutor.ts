/**
 * Ghost Control — Executor
 * 
 * Führt Ghost Steps aus (navigate, click, fill, etc.).
 * 
 * @module lib/ghost/GhostExecutor
 */

import { GhostStep, GhostState } from './GhostPlan.types';

/**
 * Ghost Executor Class
 * 
 * Verantwortlich für die Ausführung von Ghost Steps.
 */
export class GhostExecutor {
  private state: GhostState;
  private setState: (state: Partial<GhostState>) => void;
  private onStepComplete: () => void;
  private onError: (error: string) => void;

  constructor(
    state: GhostState,
    setState: (state: Partial<GhostState>) => void,
    onStepComplete: () => void,
    onError: (error: string) => void
  ) {
    this.state = state;
    this.setState = setState;
    this.onStepComplete = onStepComplete;
    this.onError = onError;
  }

  /**
   * Führe einen Step aus
   */
  async execute(step: GhostStep): Promise<void> {
    try {
      switch (step.type) {
        case 'navigate':
          await this.navigate(step.target!);
          break;
        case 'spotlight':
          await this.spotlight(step.target!);
          break;
        case 'click':
          await this.click(step.target!);
          break;
        case 'fill':
          await this.fill(step.target!, step.value!);
          break;
        case 'api_call':
          await this.apiCall(step);
          break;
        case 'speak':
          await this.speak(step.callout, step.duration);
          break;
        case 'wait':
          await this.wait(step.duration || 1000);
          break;
        case 'confirm':
          await this.confirm(step);
          break;
        default:
          throw new Error(`Unknown step type: ${step.type}`);
      }
    } catch (error) {
      this.onError(error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Navigiere zu einer URL
   */
  private async navigate(route: string): Promise<void> {
    // Wird von der UI-Komponente übernommen
    console.log('[GhostExecutor] Navigate:', route);
    await this.wait(500);
  }

  /**
   * Spotlight auf einem Element
   */
  private async spotlight(selector: string): Promise<void> {
    const element = document.querySelector(selector);
    if (!element) {
      throw new Error(`Element not found: ${selector}`);
    }
    
    const rect = element.getBoundingClientRect();
    this.setState({
      cursorPosition: {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      },
    });
    
    await this.wait(300);
  }

  /**
   * Klicke auf ein Element
   */
  private async click(selector: string): Promise<void> {
    const element = document.querySelector(selector);
    if (!element) {
      throw new Error(`Element not found: ${selector}`);
    }
    
    // Spotlight zuerst
    await this.spotlight(selector);
    
    // Click simulieren
    element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await this.wait(300);
  }

  /**
   * Fülle ein Formular-Feld
   */
  private async fill(selector: string, value: string): Promise<void> {
    const element = document.querySelector(selector) as HTMLInputElement;
    if (!element) {
      throw new Error(`Element not found: ${selector}`);
    }
    
    // Spotlight zuerst
    await this.spotlight(selector);
    
    // Wert setzen
    element.value = value;
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    
    await this.wait(500);
  }

  /**
   * API Call ausführen
   */
  private async apiCall(step: GhostStep): Promise<void> {
    if (!step.payload || !step.target) {
      throw new Error('API call requires target and payload');
    }

    console.log('[GhostExecutor] API Call:', step.target, step.payload);
    
    // Wird vom Backend ausgeführt
    await this.wait(1000);
  }

  /**
   * Text anzeigen/sprechen
   */
  private async speak(text: string, duration: number = 2500): Promise<void> {
    console.log('[GhostExecutor] Speak:', text);
    await this.wait(duration);
  }

  /**
   * Warten
   */
  private async wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Auf User-Bestätigung warten
   */
  private async confirm(step: GhostStep): Promise<void> {
    console.log('[GhostExecutor] Waiting for confirmation:', step.callout);
    this.setState({ status: 'waiting_confirmation' });
    
    // Wartet auf user.confirm() von außen
    return new Promise(resolve => {
      // Wird von GhostContext aufgelöst wenn User bestätigt
      const checkConfirmation = setInterval(() => {
        if (this.state.status !== 'waiting_confirmation') {
          clearInterval(checkConfirmation);
          resolve();
        }
      }, 100);
    });
  }
}

export default GhostExecutor;
