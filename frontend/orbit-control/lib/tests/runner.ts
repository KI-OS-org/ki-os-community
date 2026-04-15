/**
 * KI-OS Frontend Test Runner — Engine
 * Führt Tests sequenziell aus, meldet Ergebnisse in Echtzeit.
 */

export type TestStatus = "pending" | "running" | "pass" | "fail" | "skip" | "warn";

export interface TestStep {
  id:       string;
  group:    string;
  name:     string;
  critical: boolean;         // Bei Fehler → Rest der Gruppe überspringen
  fn:       (ctx: TestContext) => Promise<void>;
}

export interface TestResult {
  id:       string;
  group:    string;
  name:     string;
  status:   TestStatus;
  message:  string;
  durationMs: number;
  detail?:  string;          // Zusätzliche Info (z.B. Response-Body-Ausschnitt)
}

export interface TestContext {
  store: Record<string, unknown>;    // Geteilter Zustand zwischen Steps (z.B. agentId)
  log:   (msg: string) => void;
  assert: (condition: boolean, message: string) => void;
  warn:   (message: string) => void;
}

export type OnStepUpdate = (result: TestResult) => void;

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------
export async function runTests(
  steps: TestStep[],
  onUpdate: OnStepUpdate,
  signal?: AbortSignal,
): Promise<TestResult[]> {
  const results: TestResult[] = [];
  const store: Record<string, unknown> = {};
  const skippedGroups = new Set<string>();

  for (const step of steps) {
    if (signal?.aborted) break;

    // Gruppe übersprungen wegen kritischem Fehler
    if (skippedGroups.has(step.group)) {
      const r: TestResult = {
        id: step.id, group: step.group, name: step.name,
        status: "skip", message: "Übersprungen (vorheriger kritischer Fehler)", durationMs: 0,
      };
      results.push(r);
      onUpdate(r);
      continue;
    }

    // Start-Signal
    onUpdate({
      id: step.id, group: step.group, name: step.name,
      status: "running", message: "Läuft…", durationMs: 0,
    });

    const t0 = performance.now();
    let status: TestStatus    = "pass";
    let message               = "OK";
    let detail: string | undefined;
    let warnMessage: string | undefined;

    const ctx: TestContext = {
      store,
      log:    (msg) => { detail = msg; },
      assert: (cond, msg) => { if (!cond) throw new Error(msg); },
      warn:   (msg) => { warnMessage = msg; },
    };

    try {
      await step.fn(ctx);
      if (warnMessage) { status = "warn"; message = warnMessage; }
    } catch (e) {
      status  = "fail";
      message = e instanceof Error ? e.message : String(e);
      if (step.critical) skippedGroups.add(step.group);
    }

    const r: TestResult = {
      id: step.id, group: step.group, name: step.name,
      status, message, durationMs: Math.round(performance.now() - t0), detail,
    };
    results.push(r);
    onUpdate(r);

    // Kurze Pause damit UI atmen kann
    await delay(120);
  }
  return results;
}

export function delay(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

// ---------------------------------------------------------------------------
// Assertions
// ---------------------------------------------------------------------------
export function assertOk(res: { ok: boolean; status: number }, label = "") {
  if (!res.ok) throw new Error(`${label} HTTP ${res.status} (erwartet 2xx)`);
}

export function assertHas<T extends object>(obj: T, key: keyof T, label = "") {
  if (obj[key] === undefined || obj[key] === null) {
    throw new Error(`${label}: Feld '${String(key)}' fehlt in Antwort`);
  }
}
