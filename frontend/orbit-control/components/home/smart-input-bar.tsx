"use client";

import { useState, FormEvent } from "react";
import { Sparkles, ArrowRight, Ghost } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useGhostControl } from "@/lib/ghost/useGhostControl";
import { GhostDialog } from "@/components/ghost/GhostDialog";

interface SmartInputBarProps {
  placeholder?: string;
  defaultValue?: string;
}

export function SmartInputBar({ placeholder = "Was möchtest du erreichen?", defaultValue = "" }: SmartInputBarProps) {
  const router = useRouter();
  const [value, setValue] = useState(defaultValue);
  const [loading, setLoading] = useState(false);
  const [showGhostDialog, setShowGhostDialog] = useState(false);
  const [ghostQuestion, setGhostQuestion] = useState("");
  const [pendingPlan, setPendingPlan] = useState<any>(null);

  const { start: startGhost } = useGhostControl();

  async function handleStart() {
    console.log('[SmartInputBar] handleStart called');
    
    const query = value.trim();
    console.log('[SmartInputBar] Query:', query);
    
    if (!query) {
      console.log('[SmartInputBar] No query, returning');
      return;
    }

    console.log('[SmartInputBar] Setting loading true');
    setLoading(true);

    try {
      console.log('[SmartInputBar] Fetching /api/ghost/plan');

      // Ghost Plan generieren
      const response = await fetch('/api/ghost/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          goal: query,
          mode: 'demo', // Standard: Demo-Modus
        }),
      });

      console.log('[SmartInputBar] Response status:', response.status);

      const data = await response.json();
      console.log('[SmartInputBar] Response data:', data);

      if (data.success && data.plan) {
        console.log('[SmartInputBar] Success, starting Ghost');
        const plan = data.plan;

        // Prüfen ob Intent klar ist
        if (data.plan.needsClarification) {
          console.log('[SmartInputBar] Needs clarification, showing dialog');
          // Dialog anzeigen
          setGhostQuestion(data.plan.question);
          setShowGhostDialog(true);
          setPendingPlan(plan);
        } else {
          console.log('[SmartInputBar] No clarification needed, starting Ghost');
          // Ghost Control starten
          await startGhost(plan);
        }
      } else {
        console.log('[SmartInputBar] No success, using fallback');
        // Fallback: Normale Navigation
        router.push(`/workspace?goal=${encodeURIComponent(query)}`);
      }
    } catch (error) {
      console.error('[SmartInputBar] Error:', error);
      // Fallback bei Fehler
      router.push(`/workspace?goal=${encodeURIComponent(query)}`);
    } finally {
      console.log('[SmartInputBar] Setting loading false');
      setLoading(false);
    }
  }

  function handleGhostDemo() {
    console.log('[SmartInputBar] handleGhostDemo called');
    setShowGhostDialog(false);
    if (pendingPlan) {
      startGhost({ ...pendingPlan, mode: 'demo' });
      setPendingPlan(null);
    }
  }

  function handleGhostBuild() {
    console.log('[SmartInputBar] handleGhostBuild called');
    setShowGhostDialog(false);
    if (pendingPlan) {
      startGhost({ ...pendingPlan, mode: 'build' });
      setPendingPlan(null);
    }
  }

  function handleKeyDown(event: React.KeyboardEvent) {
    console.log('[SmartInputBar] handleKeyDown:', event.key);
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleStart();
    }
  }

  function handleSubmit(event: FormEvent) {
    console.log('[SmartInputBar] handleSubmit called');
    event.preventDefault();
    handleStart();
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="rounded-[30px] border border-white/10 bg-black/25 p-4 backdrop-blur md:p-5">
        <div className="mb-3 flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
          <Sparkles className="size-4 text-cyan-300" />
          Beschreibe dein Ziel in Alltagssprache — KIMBA übernimmt das Steuer.
        </div>
        <div className="flex flex-col gap-3 md:flex-row">
          <textarea
            value={value}
            onChange={(event) => {
              console.log('[SmartInputBar] Value changed:', event.target.value);
              setValue(event.target.value);
            }}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={loading}
            className="min-h-28 flex-1 rounded-[24px] border border-white/8 bg-white/4 px-4 py-3 text-sm outline-none placeholder:text-[var(--muted-foreground)] focus:border-cyan-400/40 disabled:opacity-50"
            rows={3}
          />
          <div className="flex flex-col gap-3 md:w-56">
            <Button
              type="submit"
              className="h-12 justify-between"
              disabled={loading || !value.trim()}
            >
              {loading ? (
                <>
                  <Ghost className="size-4 animate-pulse" />
                  KIMBA denkt...
                </>
              ) : (
                <>
                  Aufgabe starten
                  <ArrowRight className="size-4" />
                </>
              )}
            </Button>
            <div className="rounded-[20px] border border-white/8 bg-white/3 p-3 text-xs text-[var(--muted-foreground)]">
              <div className="flex items-start gap-2">
                <Ghost className="size-3.5 mt-0.5 text-[#5ac4ff]" />
                <span>
                  <strong>Neu:</strong> KIMBA kann Aufgaben für dich übernehmen.
                  Einfach beschreiben und zuschauen!
                </span>
              </div>
            </div>
          </div>
        </div>
      </form>

      {/* Ghost Dialog */}
      <GhostDialog
        question={ghostQuestion}
        visible={showGhostDialog}
        onDemo={handleGhostDemo}
        onBuild={handleGhostBuild}
      />
    </>
  );
}
